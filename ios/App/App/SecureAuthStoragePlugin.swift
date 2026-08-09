import Foundation
import Security
import Capacitor

/**
 * First-party Capacitor plugin that stores Supabase Auth session material
 * in the Apple Keychain. No plaintext fallback.
 */
@objc(SecureAuthStoragePlugin)
public class SecureAuthStoragePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SecureAuthStoragePlugin"
    public let jsName = "SecureAuthStorage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    private static let service = "com.drevora.worker.secure-auth-storage"
    private static let errorCode = "SECURE_STORAGE_ERROR"
    private static let errorMessage = "Secure storage unavailable"

    @objc func getItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("Missing key", Self.errorCode)
            return
        }

        do {
            let value = try readItem(account: key)
            if let value = value {
                call.resolve(["value": value])
            } else {
                call.resolve(["value": NSNull()])
            }
        } catch {
            call.reject(Self.errorMessage, Self.errorCode, error)
        }
    }

    @objc func setItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("Missing key or value", Self.errorCode)
            return
        }
        guard let value = call.getString("value") else {
            call.reject("Missing key or value", Self.errorCode)
            return
        }

        do {
            try writeItem(account: key, value: value)
            call.resolve()
        } catch {
            call.reject(Self.errorMessage, Self.errorCode, error)
        }
    }

    @objc func removeItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("Missing key", Self.errorCode)
            return
        }

        do {
            try deleteItem(account: key)
            call.resolve()
        } catch {
            call.reject(Self.errorMessage, Self.errorCode, error)
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        do {
            try deleteAllItemsForService()
            call.resolve()
        } catch {
            call.reject(Self.errorMessage, Self.errorCode, error)
        }
    }

    // MARK: - Keychain

    private func readItem(account: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess else {
            throw keychainError(status)
        }
        guard let data = result as? Data else {
            throw keychainError(errSecDecode)
        }
        guard let value = String(data: data, encoding: .utf8) else {
            throw keychainError(errSecDecode)
        }
        return value
    }

    private func writeItem(account: String, value: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw keychainError(errSecParam)
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.service,
            kSecAttrAccount as String: account
        ]

        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData as String] = data
            addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            status = SecItemAdd(addQuery as CFDictionary, nil)
        }

        guard status == errSecSuccess else {
            throw keychainError(status)
        }
    }

    private func deleteItem(account: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.service,
            kSecAttrAccount as String: account
        ]

        let status = SecItemDelete(query as CFDictionary)
        if status == errSecSuccess || status == errSecItemNotFound {
            return
        }
        throw keychainError(status)
    }

    /// Deletes only generic-password items for this plugin's service identifier.
    private func deleteAllItemsForService() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.service
        ]

        let status = SecItemDelete(query as CFDictionary)
        if status == errSecSuccess || status == errSecItemNotFound {
            return
        }
        throw keychainError(status)
    }

    private func keychainError(_ status: OSStatus) -> NSError {
        NSError(
            domain: "SecureAuthStorage",
            code: Int(status),
            userInfo: [
                NSLocalizedDescriptionKey: SecCopyErrorMessageString(status, nil) as String?
                    ?? "Keychain error \(status)"
            ]
        )
    }
}
