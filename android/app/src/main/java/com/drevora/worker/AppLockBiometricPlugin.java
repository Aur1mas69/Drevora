package com.drevora.worker;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.view.WindowManager;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.Executor;

/**
 * First-party Capacitor plugin for DREVORA Worker biometric app lock.
 *
 * Stores only local enabled/timeout preferences. Does not touch SecureAuthStorage,
 * Keystore keys, Supabase sessions, or biometric templates.
 */
@CapacitorPlugin(name = "AppLockBiometric")
public class AppLockBiometricPlugin extends Plugin {

    private static final String PREFS_NAME = "drevora_app_lock_preferences";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_TIMEOUT_MS = "timeoutMs";
    private static final long DEFAULT_TIMEOUT_MS = 60_000L;
    private static final String EVENT_SCREEN_OFF = "screenOff";

    private final Object promptLock = new Object();
    private int promptGeneration = 0;
    private BiometricPrompt activePrompt;
    private PluginCall activeAuthCall;
    private boolean screenOffReceiverRegistered = false;

    private final BroadcastReceiver screenOffReceiver =
        new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || !Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                    return;
                }
                notifyListeners(EVENT_SCREEN_OFF, new JSObject());
            }
        };

    @Override
    public void load() {
        registerScreenOffReceiver();
    }

    @Override
    protected void handleOnDestroy() {
        cancelActivePromptInternal();
        unregisterScreenOffReceiver();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getAvailability(PluginCall call) {
        boolean allowDeviceCredential = Boolean.TRUE.equals(call.getBoolean("allowDeviceCredential", true));
        Activity activity = getActivity();
        if (activity == null) {
            JSObject result = new JSObject();
            result.put("status", "unknown");
            call.resolve(result);
            return;
        }

        int authenticators = resolveAuthenticators(allowDeviceCredential);
        int code = BiometricManager.from(activity).canAuthenticate(authenticators);
        JSObject result = new JSObject();
        result.put("status", mapAvailabilityStatus(code));
        call.resolve(result);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        String title = call.getString("title");
        if (title == null || title.trim().isEmpty()) {
            title = "Unlock DREVORA";
        }
        String subtitle = call.getString("subtitle");
        boolean allowDeviceCredential = Boolean.TRUE.equals(call.getBoolean("allowDeviceCredential", true));

        Activity activity = getActivity();
        if (!(activity instanceof FragmentActivity)) {
            call.reject("activityUnavailable", "activityUnavailable");
            return;
        }

        final FragmentActivity fragmentActivity = (FragmentActivity) activity;
        final String promptTitle = title;
        final String promptSubtitle = subtitle;
        final boolean allowCredential = allowDeviceCredential;

        fragmentActivity.runOnUiThread(
            () -> startAuthentication(call, fragmentActivity, promptTitle, promptSubtitle, allowCredential)
        );
    }

    @PluginMethod
    public void cancelAuthentication(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            cancelActivePromptInternal();
            call.resolve();
            return;
        }
        activity.runOnUiThread(
            () -> {
                cancelActivePromptInternal();
                call.resolve();
            }
        );
    }

    @PluginMethod
    public void getPreferences(PluginCall call) {
        SharedPreferences prefs = getPrefs();
        JSObject result = new JSObject();
        result.put("enabled", prefs.getBoolean(KEY_ENABLED, false));
        result.put("timeoutMs", normalizeTimeoutMs(prefs.getLong(KEY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)));
        call.resolve(result);
    }

    @PluginMethod
    public void setPreferences(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("Missing enabled", "unknown");
            return;
        }
        long timeoutMs = normalizeTimeoutMs(readTimeoutMs(call));
        SharedPreferences.Editor editor = getPrefs().edit();
        editor.putBoolean(KEY_ENABLED, enabled);
        editor.putLong(KEY_TIMEOUT_MS, timeoutMs);
        if (!editor.commit()) {
            call.reject("Unable to save preferences", "unknown");
            return;
        }
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        result.put("timeoutMs", timeoutMs);
        call.resolve(result);
    }

    @PluginMethod
    public void clearPreferences(PluginCall call) {
        SharedPreferences.Editor editor = getPrefs().edit();
        editor.clear();
        if (!editor.commit()) {
            call.reject("Unable to clear preferences", "unknown");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void setSecureScreen(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("Missing enabled", "unknown");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("activityUnavailable", "activityUnavailable");
            return;
        }
        final boolean secure = enabled;
        activity.runOnUiThread(
            () -> {
                try {
                    if (secure) {
                        activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    } else {
                        activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    }
                    call.resolve();
                } catch (Exception e) {
                    call.reject("activityUnavailable", "activityUnavailable");
                }
            }
        );
    }

    private void startAuthentication(
        PluginCall call,
        FragmentActivity activity,
        String title,
        String subtitle,
        boolean allowDeviceCredential
    ) {
        final int generation;
        synchronized (promptLock) {
            if (activeAuthCall != null) {
                call.reject("promptAlreadyActive", "promptAlreadyActive");
                return;
            }
            promptGeneration += 1;
            generation = promptGeneration;
            activeAuthCall = call;
        }

        int authenticators = resolveAuthenticators(allowDeviceCredential);
        int availability = BiometricManager.from(activity).canAuthenticate(authenticators);
        if (availability != BiometricManager.BIOMETRIC_SUCCESS) {
            finishAuthCall(generation, false, "notAvailable");
            return;
        }

        Executor executor = ContextCompat.getMainExecutor(activity);
        BiometricPrompt.AuthenticationCallback callback =
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(
                    @NonNull BiometricPrompt.AuthenticationResult result
                ) {
                    finishAuthCall(generation, true, null);
                }

                @Override
                public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                    finishAuthCall(generation, false, mapAuthError(errorCode));
                }

                @Override
                public void onAuthenticationFailed() {
                    // Wrong biometric attempt — keep waiting; do not unlock.
                }
            };

        BiometricPrompt prompt = new BiometricPrompt(activity, executor, callback);
        synchronized (promptLock) {
            if (activeAuthCall != call || generation != promptGeneration) {
                call.reject("cancelled", "cancelled");
                return;
            }
            activePrompt = prompt;
        }

        BiometricPrompt.PromptInfo.Builder builder =
            new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setAllowedAuthenticators(authenticators);

        if (subtitle != null && !subtitle.trim().isEmpty()) {
            builder.setSubtitle(subtitle);
        }

        // Negative button is required when DEVICE_CREDENTIAL is not allowed.
        if (!includesDeviceCredential(authenticators)) {
            builder.setNegativeButtonText("Cancel");
        }

        try {
            prompt.authenticate(builder.build());
        } catch (Exception e) {
            finishAuthCall(generation, false, "unknown");
        }
    }

    private void finishAuthCall(int generation, boolean success, String errorCode) {
        PluginCall callToFinish = null;
        synchronized (promptLock) {
            if (generation != promptGeneration) {
                return;
            }
            callToFinish = activeAuthCall;
            activeAuthCall = null;
            activePrompt = null;
        }
        if (callToFinish == null) {
            return;
        }
        if (success) {
            JSObject result = new JSObject();
            result.put("success", true);
            callToFinish.resolve(result);
            return;
        }
        String code = errorCode == null ? "unknown" : errorCode;
        callToFinish.reject(code, code);
    }

    private void cancelActivePromptInternal() {
        final BiometricPrompt prompt;
        final PluginCall call;
        synchronized (promptLock) {
            promptGeneration += 1;
            prompt = activePrompt;
            call = activeAuthCall;
            activePrompt = null;
            activeAuthCall = null;
        }
        if (prompt != null) {
            try {
                prompt.cancelAuthentication();
            } catch (Exception ignored) {
                // Best-effort cancel.
            }
        }
        if (call != null) {
            // generation already bumped; reject the orphaned call once.
            call.reject("cancelled", "cancelled");
        }
    }

    private void registerScreenOffReceiver() {
        if (screenOffReceiverRegistered) {
            return;
        }
        Context context = getContext();
        if (context == null) {
            return;
        }
        IntentFilter filter = new IntentFilter(Intent.ACTION_SCREEN_OFF);
        ContextCompat.registerReceiver(
            context,
            screenOffReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
        screenOffReceiverRegistered = true;
    }

    private void unregisterScreenOffReceiver() {
        if (!screenOffReceiverRegistered) {
            return;
        }
        Context context = getContext();
        if (context != null) {
            try {
                context.unregisterReceiver(screenOffReceiver);
            } catch (Exception ignored) {
                // Already unregistered.
            }
        }
        screenOffReceiverRegistered = false;
    }

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static long readTimeoutMs(PluginCall call) {
        Integer timeoutInt = call.getInt("timeoutMs");
        if (timeoutInt != null) {
            return timeoutInt.longValue();
        }
        Double timeoutDouble = call.getDouble("timeoutMs");
        if (timeoutDouble != null) {
            return timeoutDouble.longValue();
        }
        return DEFAULT_TIMEOUT_MS;
    }

    private static long normalizeTimeoutMs(long timeoutMs) {
        if (timeoutMs == 0L || timeoutMs == 30_000L || timeoutMs == 60_000L || timeoutMs == 300_000L) {
            return timeoutMs;
        }
        return DEFAULT_TIMEOUT_MS;
    }

    private static int resolveAuthenticators(boolean allowDeviceCredential) {
        if (allowDeviceCredential && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return BiometricManager.Authenticators.BIOMETRIC_STRONG
                | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        }
        return BiometricManager.Authenticators.BIOMETRIC_STRONG;
    }

    private static boolean includesDeviceCredential(int authenticators) {
        return (authenticators & BiometricManager.Authenticators.DEVICE_CREDENTIAL) != 0;
    }

    private static String mapAvailabilityStatus(int code) {
        switch (code) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                return "available";
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                return "noHardware";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                return "temporarilyUnavailable";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "notEnrolled";
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:
                return "securityUpdateRequired";
            default:
                // 14 = BIOMETRIC_ERROR_UNSUPPORTED on newer AndroidX; keep 1.1.0-safe.
                if (code == 14) {
                    return "unsupported";
                }
                return "unknown";
        }
    }

    private static String mapAuthError(int errorCode) {
        switch (errorCode) {
            case BiometricPrompt.ERROR_CANCELED:
            case BiometricPrompt.ERROR_USER_CANCELED:
            case BiometricPrompt.ERROR_NEGATIVE_BUTTON:
                return "cancelled";
            case BiometricPrompt.ERROR_LOCKOUT:
                return "lockedOut";
            case BiometricPrompt.ERROR_LOCKOUT_PERMANENT:
                return "permanentlyLockedOut";
            case BiometricPrompt.ERROR_HW_NOT_PRESENT:
            case BiometricPrompt.ERROR_HW_UNAVAILABLE:
            case BiometricPrompt.ERROR_NO_BIOMETRICS:
            case BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL:
            case BiometricPrompt.ERROR_NO_SPACE:
            case BiometricPrompt.ERROR_SECURITY_UPDATE_REQUIRED:
                return "notAvailable";
            case BiometricPrompt.ERROR_UNABLE_TO_PROCESS:
            case BiometricPrompt.ERROR_TIMEOUT:
            case BiometricPrompt.ERROR_VENDOR:
                return "failed";
            default:
                return "unknown";
        }
    }
}
