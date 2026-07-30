package com.drevora.worker;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/**
 * First-party Capacitor plugin that stores Supabase Auth session material using
 * AES-256-GCM with a non-exportable AndroidKeyStore key. Only ciphertext envelopes
 * are persisted in app-private SharedPreferences.
 */
@CapacitorPlugin(name = "SecureAuthStorage")
public class SecureAuthStoragePlugin extends Plugin {

    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "drevora_secure_auth_aes_v1";
    private static final String PREFS_NAME = "drevora_secure_auth_storage";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH_BYTES = 12;
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int AES_KEY_SIZE_BITS = 256;
    private static final int FORMAT_VERSION = 1;
    private static final String ERROR_CODE = "SECURE_STORAGE_ERROR";
    private static final String ERROR_MESSAGE = "Secure storage unavailable";

    @PluginMethod
    public void getItem(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("Missing key", ERROR_CODE);
            return;
        }

        try {
            resolveValue(call, readItem(key));
        } catch (KeystoreUnusableException e) {
            resetSecureStorage();
            resolveValue(call, null);
        } catch (Exception e) {
            resolveValue(call, null);
        }
    }

    @PluginMethod
    public void setItem(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null || key.isEmpty() || value == null) {
            call.reject("Missing key or value", ERROR_CODE);
            return;
        }

        try {
            writeItem(key, value);
            call.resolve();
        } catch (Exception firstFailure) {
            try {
                resetSecureStorage();
                writeItem(key, value);
                call.resolve();
            } catch (Exception retryFailure) {
                call.reject(ERROR_MESSAGE, ERROR_CODE);
            }
        }
    }

    @PluginMethod
    public void removeItem(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("Missing key", ERROR_CODE);
            return;
        }

        try {
            SharedPreferences prefs = getPrefs();
            boolean committed = prefs.edit().remove(hashKey(key)).commit();
            if (!committed) {
                call.reject(ERROR_MESSAGE, ERROR_CODE);
                return;
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(ERROR_MESSAGE, ERROR_CODE);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        try {
            if (!clearEncryptedPreferences()) {
                call.reject(ERROR_MESSAGE, ERROR_CODE);
                return;
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(ERROR_MESSAGE, ERROR_CODE);
        }
    }

    private void resolveValue(PluginCall call, String value) {
        JSObject result = new JSObject();
        if (value == null) {
            result.put("value", JSONObject.NULL);
        } else {
            result.put("value", value);
        }
        call.resolve(result);
    }

    private String readItem(String key) throws Exception {
        SharedPreferences prefs = getPrefs();
        String prefKey = hashKey(key);
        String envelope = prefs.getString(prefKey, null);
        if (envelope == null) {
            return null;
        }

        try {
            return decryptEnvelope(key, envelope);
        } catch (KeystoreUnusableException e) {
            throw e;
        } catch (Exception e) {
            prefs.edit().remove(prefKey).commit();
            return null;
        }
    }

    private void writeItem(String key, String value) throws Exception {
        String envelope = encryptEnvelope(key, value);
        SharedPreferences prefs = getPrefs();
        boolean committed = prefs.edit().putString(hashKey(key), envelope).commit();
        if (!committed) {
            throw new IllegalStateException("commit failed");
        }
    }

    private String encryptEnvelope(String key, String value) throws Exception {
        SecretKey secretKey = getOrCreateSecretKey();

        // AndroidKeyStore rejects caller-provided IVs when randomized encryption is
        // required. Let the Cipher generate the IV, then persist cipher.getIV().
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, secretKey);
        cipher.updateAAD(key.getBytes(StandardCharsets.UTF_8));
        byte[] ciphertext = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        byte[] iv = cipher.getIV();
        if (iv == null || iv.length != GCM_IV_LENGTH_BYTES) {
            throw new IllegalStateException("invalid generated iv length");
        }

        JSONObject envelope = new JSONObject();
        envelope.put("v", FORMAT_VERSION);
        envelope.put("iv", Base64.encodeToString(iv, Base64.NO_WRAP));
        envelope.put("ct", Base64.encodeToString(ciphertext, Base64.NO_WRAP));
        return envelope.toString();
    }

    private String decryptEnvelope(String key, String envelopeJson) throws Exception {
        JSONObject envelope;
        try {
            envelope = new JSONObject(envelopeJson);
        } catch (Exception e) {
            throw new IllegalArgumentException("invalid envelope");
        }

        if (envelope.optInt("v", -1) != FORMAT_VERSION) {
            throw new IllegalArgumentException("unsupported format");
        }

        String ivB64 = envelope.optString("iv", null);
        String ctB64 = envelope.optString("ct", null);
        if (ivB64 == null || ctB64 == null || ivB64.isEmpty() || ctB64.isEmpty()) {
            throw new IllegalArgumentException("missing fields");
        }

        byte[] iv;
        byte[] ciphertext;
        try {
            iv = Base64.decode(ivB64, Base64.NO_WRAP);
            ciphertext = Base64.decode(ctB64, Base64.NO_WRAP);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("invalid base64");
        }

        if (iv.length != GCM_IV_LENGTH_BYTES || ciphertext.length == 0) {
            throw new IllegalArgumentException("invalid lengths");
        }

        SecretKey secretKey = getExistingSecretKey();
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        try {
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            cipher.updateAAD(key.getBytes(StandardCharsets.UTF_8));
            byte[] plaintext = cipher.doFinal(ciphertext);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (AEADBadTagException e) {
            throw e;
        } catch (java.security.InvalidKeyException e) {
            // Includes KeyPermanentlyInvalidatedException (InvalidKeyException subclass).
            throw new KeystoreUnusableException(e);
        }
    }

    private SecretKey getOrCreateSecretKey() throws Exception {
        try {
            SecretKey existing = getExistingSecretKeyOrNull();
            if (existing != null) {
                return existing;
            }
            return generateSecretKey();
        } catch (KeystoreUnusableException e) {
            throw e;
        } catch (Exception e) {
            throw new KeystoreUnusableException(e);
        }
    }

    private SecretKey getExistingSecretKey() throws Exception {
        SecretKey key = getExistingSecretKeyOrNull();
        if (key == null) {
            throw new KeystoreUnusableException(new IllegalStateException("missing key"));
        }
        return key;
    }

    private SecretKey getExistingSecretKeyOrNull() throws Exception {
        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
            keyStore.load(null);
            if (!keyStore.containsAlias(KEY_ALIAS)) {
                return null;
            }
            KeyStore.Entry entry = keyStore.getEntry(KEY_ALIAS, null);
            if (!(entry instanceof KeyStore.SecretKeyEntry)) {
                throw new KeystoreUnusableException(new IllegalStateException("invalid entry"));
            }
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        } catch (KeystoreUnusableException e) {
            throw e;
        } catch (java.security.UnrecoverableKeyException | java.security.KeyStoreException e) {
            throw new KeystoreUnusableException(e);
        }
    }

    private SecretKey generateSecretKey() throws Exception {
        KeyGenerator keyGenerator =
                KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER);
        KeyGenParameterSpec spec =
                new KeyGenParameterSpec.Builder(
                                KEY_ALIAS,
                                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                        .setKeySize(AES_KEY_SIZE_BITS)
                        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                        .setRandomizedEncryptionRequired(true)
                        .setUserAuthenticationRequired(false)
                        .build();
        keyGenerator.init(spec);
        return keyGenerator.generateKey();
    }

    private void resetSecureStorage() {
        clearEncryptedPreferences();
        deleteKeystoreAlias();
    }

    private boolean clearEncryptedPreferences() {
        return getPrefs().edit().clear().commit();
    }

    private void deleteKeystoreAlias() {
        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) {
                keyStore.deleteEntry(KEY_ALIAS);
            }
        } catch (Exception ignored) {
            // Best-effort cleanup; subsequent writes regenerate the key.
        }
    }

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static String hashKey(String key) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(key.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder(hash.length * 2);
        for (byte b : hash) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString();
    }

    private static final class KeystoreUnusableException extends Exception {
        KeystoreUnusableException(Throwable cause) {
            super(cause);
        }
    }
}
