import Foundation
import LocalAuthentication
import UIKit
import Capacitor

/**
 * First-party Capacitor plugin for DREVORA Worker biometric app lock (iOS).
 *
 * Stores only local enabled/timeout preferences in UserDefaults.
 * Does not touch SecureAuthStorage, Keychain auth sessions, or biometric templates.
 *
 * screenOff: Android ACTION_SCREEN_OFF has no public iOS equivalent that is distinct
 * from app backgrounding. JS already locks via @capacitor/app appStateChange timeouts;
 * this plugin intentionally does not emit synthetic screenOff events (avoids duplicate /
 * immediate locks that would ignore timeoutMs). addListener('screenOff') remains valid.
 *
 * setSecureScreen: iOS has no FLAG_SECURE. This method resolves successfully and applies
 * a best-effort blank overlay only while UIScreen.isCaptured (screen recording / AirPlay).
 * It does not cryptographically prevent screenshots.
 */
@objc(AppLockBiometricPlugin)
public class AppLockBiometricPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppLockBiometricPlugin"
    public let jsName = "AppLockBiometric"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getAvailability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelAuthentication", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPreferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPreferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPreferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSecureScreen", returnType: CAPPluginReturnPromise)
    ]

    private static let prefsSuitePrefix = "com.drevora.worker.app_lock."
    private static let keyEnabled = prefsSuitePrefix + "enabled"
    private static let keyTimeoutMs = prefsSuitePrefix + "timeoutMs"
    private static let defaultTimeoutMs = 60_000
    private static let defaultReason = "Authenticate to unlock DREVORA."

    private let authLock = NSLock()
    private var promptGeneration = 0
    private var activeContext: LAContext?
    private var activeAuthCall: CAPPluginCall?

    private var secureScreenEnabled = false
    private var captureObserver: NSObjectProtocol?
    private weak var privacyOverlay: UIView?

    override public func load() {
        captureObserver = NotificationCenter.default.addObserver(
            forName: UIScreen.capturedDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.updatePrivacyOverlay()
        }
    }

    deinit {
        if let captureObserver {
            NotificationCenter.default.removeObserver(captureObserver)
        }
        cancelActivePromptInternal(rejectActiveCall: false)
        removePrivacyOverlay()
    }

    // MARK: - Plugin methods

    @objc func getAvailability(_ call: CAPPluginCall) {
        let allowDeviceCredential = call.getBool("allowDeviceCredential") ?? true
        let status = evaluateAvailability(allowDeviceCredential: allowDeviceCredential)
        call.resolve(["status": status])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        var title = call.getString("title")?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if title.isEmpty {
            title = "Unlock DREVORA"
        }
        let subtitle = call.getString("subtitle")?.trimmingCharacters(in: .whitespacesAndNewlines)
        let allowDeviceCredential = call.getBool("allowDeviceCredential") ?? true

        let reason: String
        if let subtitle, !subtitle.isEmpty {
            reason = subtitle
        } else {
            reason = title.isEmpty ? Self.defaultReason : title
        }

        let policy: LAPolicy = allowDeviceCredential
            ? .deviceOwnerAuthentication
            : .deviceOwnerAuthenticationWithBiometrics

        let generation: Int
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"

        authLock.lock()
        if activeAuthCall != nil {
            authLock.unlock()
            call.reject("promptAlreadyActive", "promptAlreadyActive")
            return
        }
        promptGeneration += 1
        generation = promptGeneration
        activeContext = context
        activeAuthCall = call
        authLock.unlock()

        var canError: NSError?
        guard context.canEvaluatePolicy(policy, error: &canError) else {
            let code = mapAvailabilityToAuthFailure(
                canError,
                allowDeviceCredential: allowDeviceCredential
            )
            finishAuthCall(generation: generation, success: false, errorCode: code)
            return
        }

        context.evaluatePolicy(policy, localizedReason: reason) { [weak self] success, error in
            guard let self else { return }
            DispatchQueue.main.async {
                if success {
                    self.finishAuthCall(generation: generation, success: true, errorCode: nil)
                } else {
                    let code = self.mapAuthError(error)
                    self.finishAuthCall(generation: generation, success: false, errorCode: code)
                }
            }
        }
    }

    @objc func cancelAuthentication(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.cancelActivePromptInternal(rejectActiveCall: true)
            call.resolve()
        }
    }

    @objc func getPreferences(_ call: CAPPluginCall) {
        let defaults = UserDefaults.standard
        let enabled = defaults.bool(forKey: Self.keyEnabled)
        let storedTimeout = defaults.object(forKey: Self.keyTimeoutMs) as? Int
            ?? Self.defaultTimeoutMs
        call.resolve([
            "enabled": enabled,
            "timeoutMs": Self.normalizeTimeoutMs(storedTimeout)
        ])
    }

    @objc func setPreferences(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else {
            call.reject("Missing enabled", "unknown")
            return
        }
        let timeoutMs = Self.normalizeTimeoutMs(Self.readTimeoutMs(call))
        let defaults = UserDefaults.standard
        defaults.set(enabled, forKey: Self.keyEnabled)
        defaults.set(timeoutMs, forKey: Self.keyTimeoutMs)
        call.resolve([
            "enabled": enabled,
            "timeoutMs": timeoutMs
        ])
    }

    @objc func clearPreferences(_ call: CAPPluginCall) {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: Self.keyEnabled)
        defaults.removeObject(forKey: Self.keyTimeoutMs)
        call.resolve()
    }

    @objc func setSecureScreen(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else {
            call.reject("Missing enabled", "unknown")
            return
        }
        DispatchQueue.main.async {
            self.secureScreenEnabled = enabled
            self.updatePrivacyOverlay()
            call.resolve()
        }
    }

    // MARK: - Auth helpers

    private func evaluateAvailability(allowDeviceCredential: Bool) -> String {
        let context = LAContext()
        let policy: LAPolicy = allowDeviceCredential
            ? .deviceOwnerAuthentication
            : .deviceOwnerAuthenticationWithBiometrics
        var error: NSError?
        if context.canEvaluatePolicy(policy, error: &error) {
            return "available"
        }
        return mapAvailabilityStatus(error, allowDeviceCredential: allowDeviceCredential)
    }

    /// Maps LocalAuthentication failures onto the existing JS availability contract.
    /// Prefer a concrete status over `unknown` whenever the error is classifiable.
    private func mapAvailabilityStatus(
        _ error: NSError?,
        allowDeviceCredential: Bool
    ) -> String {
        guard let error else {
            // canEvaluatePolicy failed with no error object — conservative, not "still checking".
            return "unsupported"
        }

        if error.domain == LAErrorDomain, let code = LAError.Code(rawValue: error.code) {
            switch code {
            case .biometryNotEnrolled, .passcodeNotSet:
                return "notEnrolled"
            case .biometryLockout:
                return "temporarilyUnavailable"
            case .biometryNotAvailable:
                // Biometrics-only policy: no biometric hardware/sensor.
                // Device-owner policy normally falls back to passcode; this error then
                // means owner authentication is not usable on this device/policy.
                return allowDeviceCredential ? "unsupported" : "noHardware"
            case .authenticationFailed:
                // Not expected from canEvaluatePolicy; treat as temporary.
                return "temporarilyUnavailable"
            case .userCancel, .appCancel, .systemCancel, .userFallback:
                return "unsupported"
            case .invalidContext, .notInteractive:
                return "temporarilyUnavailable"
            default:
                return "unsupported"
            }
        }

        // Non-LAErrorDomain failures from canEvaluatePolicy are unclassifiable.
        return "unknown"
    }

    private func mapAvailabilityToAuthFailure(
        _ error: NSError?,
        allowDeviceCredential: Bool
    ) -> String {
        switch mapAvailabilityStatus(error, allowDeviceCredential: allowDeviceCredential) {
        case "available":
            return "unknown"
        default:
            return "notAvailable"
        }
    }

    private func mapAuthError(_ error: Error?) -> String {
        guard let error = error as NSError? else {
            return "failed"
        }
        let code = LAError.Code(rawValue: error.code)
        switch code {
        case .userCancel, .appCancel, .systemCancel:
            return "cancelled"
        case .authenticationFailed:
            return "failed"
        case .biometryLockout:
            return "lockedOut"
        case .biometryNotAvailable, .biometryNotEnrolled, .passcodeNotSet:
            return "notAvailable"
        case .invalidContext, .notInteractive:
            return "cancelled"
        default:
            return "unknown"
        }
    }

    private func finishAuthCall(generation: Int, success: Bool, errorCode: String?) {
        let callToFinish: CAPPluginCall?
        authLock.lock()
        if generation != promptGeneration {
            authLock.unlock()
            return
        }
        callToFinish = activeAuthCall
        activeAuthCall = nil
        activeContext = nil
        authLock.unlock()

        guard let callToFinish else { return }

        if success {
            callToFinish.resolve(["success": true])
            return
        }
        let code = errorCode ?? "unknown"
        callToFinish.reject(code, code)
    }

    private func cancelActivePromptInternal(rejectActiveCall: Bool) {
        let callToReject: CAPPluginCall?
        let contextToInvalidate: LAContext?
        authLock.lock()
        promptGeneration += 1
        callToReject = rejectActiveCall ? activeAuthCall : nil
        contextToInvalidate = activeContext
        activeAuthCall = nil
        activeContext = nil
        authLock.unlock()

        contextToInvalidate?.invalidate()

        if let callToReject {
            callToReject.reject("cancelled", "cancelled")
        }
    }

    // MARK: - Preferences

    private static func readTimeoutMs(_ call: CAPPluginCall) -> Int {
        if let value = call.getInt("timeoutMs") {
            return value
        }
        if let value = call.getDouble("timeoutMs") {
            return Int(value)
        }
        return defaultTimeoutMs
    }

    private static func normalizeTimeoutMs(_ timeoutMs: Int) -> Int {
        if timeoutMs == 0 || timeoutMs == 30_000 || timeoutMs == 60_000 || timeoutMs == 300_000 {
            return timeoutMs
        }
        return defaultTimeoutMs
    }

    // MARK: - Secure screen (best-effort, public APIs only)

    private func updatePrivacyOverlay() {
        let shouldBlank = secureScreenEnabled && UIScreen.main.isCaptured
        if shouldBlank {
            presentPrivacyOverlay()
        } else {
            removePrivacyOverlay()
        }
    }

    private func presentPrivacyOverlay() {
        if privacyOverlay != nil { return }
        let window = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
        guard let window else { return }
        let overlay = UIView(frame: window.bounds)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.backgroundColor = .black
        overlay.isUserInteractionEnabled = true
        overlay.accessibilityViewIsModal = true
        window.addSubview(overlay)
        privacyOverlay = overlay
    }

    private func removePrivacyOverlay() {
        privacyOverlay?.removeFromSuperview()
        privacyOverlay = nil
    }
}
