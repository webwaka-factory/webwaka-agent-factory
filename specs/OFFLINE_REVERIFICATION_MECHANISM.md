# WebWaka Offline Re-Verification Mechanism

**Version:** 1.0  
**Last Updated:** February 1, 2026  
**Issue:** #41 (AUTH-OFF-002)

---

## Table of Contents

1. [Overview](#overview)
2. [Re-Verification Strategy](#re-verification-strategy)
3. [PIN Verification](#pin-verification)
4. [Biometric Verification](#biometric-verification)
5. [Device Trust](#device-trust)
6. [Verification UI](#verification-ui)
7. [Security Considerations](#security-considerations)
8. [Implementation Guide](#implementation-guide)
9. [Testing Strategy](#testing-strategy)
10. [Platform-Specific Implementation](#platform-specific-implementation)

---

## Overview

When users work offline, WebWaka requires periodic re-verification for security. This prevents unauthorized access if a device is left unattended or stolen. Re-verification uses **local mechanisms** (PIN, biometric, device trust) that don't require network connectivity.

### Core Principles

1. **Security without connectivity** - Verification works completely offline
2. **Tiered sensitivity** - Different operations require different verification levels
3. **User convenience** - Device trust reduces verification frequency
4. **Platform native** - Use OS-provided biometric APIs
5. **No bypass** - Security cannot be circumvented

---

## Re-Verification Strategy

### Sensitivity Levels

```typescript
enum SensitivityLevel {
  LOW = 'low',       // No re-verification required
  MEDIUM = 'medium', // PIN required
  HIGH = 'high'      // Biometric required (PIN fallback)
}

interface OperationSensitivity {
  operation: string;
  level: SensitivityLevel;
  reason: string;
}
```

### Operation Classification

| Operation | Sensitivity | Verification Required | Reason |
|-----------|-------------|----------------------|---------|
| **View tasks** | LOW | None | Read-only, low risk |
| **View dashboard** | LOW | None | Read-only, low risk |
| **Create task** | LOW | None | Low-value operation |
| **Update task** | LOW | None | Low-value operation |
| **Delete task** | MEDIUM | PIN | Destructive operation |
| **Create order** | HIGH | Biometric | Financial transaction |
| **View order history** | MEDIUM | PIN | Sensitive financial data |
| **Update inventory** | MEDIUM | PIN | Business-critical data |
| **View settings** | LOW | None | Read-only |
| **Change settings** | MEDIUM | PIN | Configuration changes |
| **Export data** | HIGH | Biometric | Bulk data access |
| **Delete account** | HIGH | Biometric | Irreversible operation |

### Verification Triggers

```typescript
interface VerificationTrigger {
  type: 'inactivity' | 'operation' | 'session_start';
  threshold?: number; // Time in milliseconds
  sensitivity?: SensitivityLevel;
}

const VERIFICATION_TRIGGERS: VerificationTrigger[] = [
  {
    type: 'inactivity',
    threshold: 30 * 60 * 1000, // 30 minutes
    sensitivity: SensitivityLevel.MEDIUM
  },
  {
    type: 'operation',
    sensitivity: SensitivityLevel.MEDIUM // Per-operation basis
  },
  {
    type: 'session_start',
    sensitivity: SensitivityLevel.HIGH // When app starts
  }
];
```

---

## PIN Verification

### PIN Requirements

- **Length:** 6 digits (000000 - 999999)
- **Storage:** Hashed with bcrypt (cost factor 10)
- **Rate Limiting:** 3 attempts, then 5-minute lockout
- **Validation:** Local only, no server verification

### PIN Storage

```typescript
interface PINStorage {
  userId: string;
  pinHash: string;      // bcrypt hash
  salt: string;         // bcrypt salt
  createdAt: number;
  lastVerified: number;
  attempts: number;     // Failed attempts counter
  lockedUntil?: number; // Lockout expiration
}

async function hashPIN(pin: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(pin, salt);
  return hash;
}

async function verifyPIN(pin: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return await bcrypt.compare(pin, hash);
}
```

### PIN Setup

```typescript
class PINManager {
  async setupPIN(userId: string, pin: string): Promise<void> {
    // Validate PIN format
    if (!/^\d{6}$/.test(pin)) {
      throw new Error('PIN must be exactly 6 digits');
    }
    
    // Check for weak PINs
    if (this.isWeakPIN(pin)) {
      throw new Error('PIN is too weak. Avoid sequences like 123456 or 000000');
    }
    
    // Hash PIN
    const pinHash = await hashPIN(pin);
    
    // Store PIN
    const storage: PINStorage = {
      userId,
      pinHash,
      salt: pinHash.substring(0, 29), // bcrypt salt is first 29 chars
      createdAt: Date.now(),
      lastVerified: Date.now(),
      attempts: 0
    };
    
    await localStore.save('pin_storage', storage);
  }
  
  private isWeakPIN(pin: string): boolean {
    const weakPatterns = [
      '000000', '111111', '222222', '333333', '444444',
      '555555', '666666', '777777', '888888', '999999',
      '123456', '654321', '012345', '543210'
    ];
    
    return weakPatterns.includes(pin);
  }
}
```

### PIN Verification

```typescript
class PINVerifier {
  async verifyPIN(userId: string, pin: string): Promise<VerificationResult> {
    // Get PIN storage
    const storage = await localStore.get('pin_storage', userId);
    
    if (!storage) {
      return {
        success: false,
        reason: 'no_pin_set',
        message: 'No PIN has been set for this account'
      };
    }
    
    // Check lockout
    if (storage.lockedUntil && Date.now() < storage.lockedUntil) {
      const remainingSeconds = Math.ceil((storage.lockedUntil - Date.now()) / 1000);
      return {
        success: false,
        reason: 'locked_out',
        message: `Too many failed attempts. Try again in ${remainingSeconds} seconds`,
        remainingSeconds
      };
    }
    
    // Verify PIN
    const isValid = await verifyPIN(pin, storage.pinHash);
    
    if (isValid) {
      // Reset attempts and update last verified
      storage.attempts = 0;
      storage.lastVerified = Date.now();
      delete storage.lockedUntil;
      await localStore.save('pin_storage', storage);
      
      return {
        success: true,
        message: 'PIN verified successfully'
      };
    } else {
      // Increment attempts
      storage.attempts++;
      
      // Check if should lock out
      if (storage.attempts >= 3) {
        storage.lockedUntil = Date.now() + (5 * 60 * 1000); // 5 minutes
        await localStore.save('pin_storage', storage);
        
        return {
          success: false,
          reason: 'max_attempts',
          message: 'Too many failed attempts. Locked out for 5 minutes',
          remainingAttempts: 0
        };
      }
      
      await localStore.save('pin_storage', storage);
      
      return {
        success: false,
        reason: 'invalid_pin',
        message: 'Invalid PIN',
        remainingAttempts: 3 - storage.attempts
      };
    }
  }
}
```

---

## Biometric Verification

### Platform APIs

```typescript
interface BiometricAPI {
  isAvailable(): Promise<boolean>;
  getSupportedTypes(): Promise<BiometricType[]>;
  authenticate(options: BiometricOptions): Promise<BiometricResult>;
}

enum BiometricType {
  FINGERPRINT = 'fingerprint',
  FACE_ID = 'face_id',
  TOUCH_ID = 'touch_id',
  IRIS = 'iris'
}

interface BiometricOptions {
  reason: string;
  fallbackEnabled: boolean;
  cancelable: boolean;
}

interface BiometricResult {
  success: boolean;
  error?: BiometricError;
}

enum BiometricError {
  NOT_AVAILABLE = 'not_available',
  NOT_ENROLLED = 'not_enrolled',
  CANCELED = 'canceled',
  FAILED = 'failed',
  LOCKED_OUT = 'locked_out'
}
```

### Web Implementation (WebAuthn)

```typescript
class WebBiometricVerifier implements BiometricAPI {
  async isAvailable(): Promise<boolean> {
    return window.PublicKeyCredential !== undefined &&
           await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }
  
  async getSupportedTypes(): Promise<BiometricType[]> {
    const available = await this.isAvailable();
    if (!available) return [];
    
    // WebAuthn doesn't expose specific biometric types
    // Return generic fingerprint/face_id
    return [BiometricType.FINGERPRINT, BiometricType.FACE_ID];
  }
  
  async authenticate(options: BiometricOptions): Promise<BiometricResult> {
    try {
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32), // Random challenge
          rpId: window.location.hostname,
          userVerification: 'required',
          timeout: 60000
        }
      });
      
      if (credential) {
        return { success: true };
      } else {
        return {
          success: false,
          error: BiometricError.CANCELED
        };
      }
    } catch (error) {
      return {
        success: false,
        error: this.mapError(error)
      };
    }
  }
  
  private mapError(error: any): BiometricError {
    if (error.name === 'NotAllowedError') {
      return BiometricError.CANCELED;
    } else if (error.name === 'NotSupportedError') {
      return BiometricError.NOT_AVAILABLE;
    } else {
      return BiometricError.FAILED;
    }
  }
}
```

### iOS Implementation (Touch ID / Face ID)

```swift
import LocalAuthentication

class IOSBiometricVerifier: BiometricAPI {
    func isAvailable() async -> Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }
    
    func getSupportedTypes() async -> [BiometricType] {
        let context = LAContext()
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
            return []
        }
        
        switch context.biometryType {
        case .faceID:
            return [.face_id]
        case .touchID:
            return [.touch_id]
        default:
            return []
        }
    }
    
    func authenticate(options: BiometricOptions) async -> BiometricResult {
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"
        context.localizedFallbackTitle = options.fallbackEnabled ? "Use PIN" : ""
        
        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: options.reason
            )
            
            return BiometricResult(success: success, error: nil)
        } catch let error as LAError {
            return BiometricResult(success: false, error: mapError(error))
        }
    }
    
    private func mapError(_ error: LAError) -> BiometricError {
        switch error.code {
        case .biometryNotAvailable:
            return .not_available
        case .biometryNotEnrolled:
            return .not_enrolled
        case .userCancel:
            return .canceled
        case .biometryLockout:
            return .locked_out
        default:
            return .failed
        }
    }
}
```

### Android Implementation (BiometricPrompt)

```kotlin
import androidx.biometric.BiometricPrompt
import androidx.biometric.BiometricManager

class AndroidBiometricVerifier : BiometricAPI {
    private val biometricManager = BiometricManager.from(context)
    
    override suspend fun isAvailable(): Boolean {
        return biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG
        ) == BiometricManager.BIOMETRIC_SUCCESS
    }
    
    override suspend fun getSupportedTypes(): List<BiometricType> {
        val available = isAvailable()
        if (!available) return emptyList()
        
        // Android doesn't expose specific biometric types
        return listOf(BiometricType.FINGERPRINT)
    }
    
    override suspend fun authenticate(options: BiometricOptions): BiometricResult {
        return suspendCoroutine { continuation ->
            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Verify Identity")
                .setSubtitle(options.reason)
                .setNegativeButtonText(if (options.cancelable) "Cancel" else "Use PIN")
                .build()
            
            val biometricPrompt = BiometricPrompt(
                activity,
                executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        continuation.resume(BiometricResult(success = true, error = null))
                    }
                    
                    override fun onAuthenticationFailed() {
                        continuation.resume(BiometricResult(success = false, error = BiometricError.FAILED))
                    }
                    
                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        continuation.resume(BiometricResult(success = false, error = mapError(errorCode)))
                    }
                }
            )
            
            biometricPrompt.authenticate(promptInfo)
        }
    }
    
    private fun mapError(errorCode: Int): BiometricError {
        return when (errorCode) {
            BiometricPrompt.ERROR_NO_BIOMETRICS -> BiometricError.NOT_ENROLLED
            BiometricPrompt.ERROR_HW_NOT_PRESENT -> BiometricError.NOT_AVAILABLE
            BiometricPrompt.ERROR_USER_CANCELED -> BiometricError.CANCELED
            BiometricPrompt.ERROR_LOCKOUT -> BiometricError.LOCKED_OUT
            else -> BiometricError.FAILED
        }
    }
}
```

---

## Device Trust

### Trust Mechanism

```typescript
interface DeviceTrust {
  deviceId: string;
  userId: string;
  trusted: boolean;
  trustedAt: number;
  expiresAt: number;
  trustDuration: number; // 7 days in milliseconds
}

class DeviceTrustManager {
  private readonly TRUST_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  async trustDevice(userId: string, deviceId: string): Promise<void> {
    const trust: DeviceTrust = {
      deviceId,
      userId,
      trusted: true,
      trustedAt: Date.now(),
      expiresAt: Date.now() + this.TRUST_DURATION,
      trustDuration: this.TRUST_DURATION
    };
    
    await localStore.save('device_trust', trust);
    console.log(`Device ${deviceId} trusted for ${userId} until ${new Date(trust.expiresAt)}`);
  }
  
  async isDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
    const trust = await localStore.get('device_trust', `${userId}-${deviceId}`);
    
    if (!trust) {
      return false;
    }
    
    // Check if trust has expired
    if (Date.now() > trust.expiresAt) {
      console.log(`Device trust expired for ${deviceId}`);
      await this.untrustDevice(userId, deviceId);
      return false;
    }
    
    return trust.trusted;
  }
  
  async untrustDevice(userId: string, deviceId: string): Promise<void> {
    await localStore.delete('device_trust', `${userId}-${deviceId}`);
    console.log(`Device ${deviceId} untrusted for ${userId}`);
  }
  
  async getTrustExpiration(userId: string, deviceId: string): Promise<number | null> {
    const trust = await localStore.get('device_trust', `${userId}-${deviceId}`);
    return trust?.expiresAt || null;
  }
}
```

### Trust-Based Verification

```typescript
async function shouldRequireVerification(
  operation: string,
  userId: string,
  deviceId: string
): Promise<boolean> {
  // Get operation sensitivity
  const sensitivity = getOperationSensitivity(operation);
  
  if (sensitivity === SensitivityLevel.LOW) {
    return false; // No verification needed
  }
  
  // Check device trust
  const isTrusted = await deviceTrustManager.isDeviceTrusted(userId, deviceId);
  
  if (isTrusted) {
    // Trusted device - reduce verification frequency
    const lastVerification = await getLastVerificationTime(userId);
    const timeSinceVerification = Date.now() - lastVerification;
    
    // Only require verification if > 1 hour since last verification
    if (timeSinceVerification < 60 * 60 * 1000) {
      return false;
    }
  }
  
  return true; // Verification required
}
```

---

## Verification UI

### PIN Entry Component

```typescript
interface PINEntryProps {
  onSubmit: (pin: string) => Promise<void>;
  onCancel: () => void;
  remainingAttempts?: number;
}

function PINEntry({ onSubmit, onCancel, remainingAttempts }: PINEntryProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async () => {
    if (pin.length !== 6) {
      setError('PIN must be 6 digits');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await onSubmit(pin);
    } catch (err) {
      setError(err.message);
      setPin(''); // Clear PIN on error
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog title="Enter PIN" closeable={false}>
      <p>Enter your 6-digit PIN to continue</p>
      
      <PINInput
        value={pin}
        onChange={setPin}
        length={6}
        autoFocus
        masked
      />
      
      {remainingAttempts !== undefined && (
        <Alert type="warning">
          {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
        </Alert>
      )}
      
      {error && <Alert type="error">{error}</Alert>}
      
      <Actions>
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          loading={loading}
          disabled={pin.length !== 6}
        >
          Verify
        </Button>
      </Actions>
    </Dialog>
  );
}
```

### Biometric Prompt Component

```typescript
interface BiometricPromptProps {
  reason: string;
  onSuccess: () => void;
  onFallback: () => void;
  onCancel: () => void;
}

function BiometricPrompt({ reason, onSuccess, onFallback, onCancel }: BiometricPromptProps) {
  const [status, setStatus] = useState<'prompting' | 'success' | 'error'>('prompting');
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    authenticateWithBiometric();
  }, []);
  
  const authenticateWithBiometric = async () => {
    const biometricAPI = getBiometricAPI();
    
    const result = await biometricAPI.authenticate({
      reason,
      fallbackEnabled: true,
      cancelable: true
    });
    
    if (result.success) {
      setStatus('success');
      onSuccess();
    } else {
      setStatus('error');
      
      if (result.error === BiometricError.CANCELED) {
        onCancel();
      } else if (result.error === BiometricError.NOT_AVAILABLE) {
        setError('Biometric authentication not available');
        onFallback();
      } else {
        setError('Biometric authentication failed');
      }
    }
  };
  
  return (
    <Dialog title="Verify Identity" closeable={false}>
      {status === 'prompting' && (
        <>
          <BiometricIcon type={getBiometricType()} animated />
          <p>{reason}</p>
          <p className="text-muted">Use your fingerprint or face to verify</p>
        </>
      )}
      
      {status === 'error' && (
        <>
          <Alert type="error">{error}</Alert>
          <Actions>
            <Button onClick={onFallback}>Use PIN Instead</Button>
            <Button onClick={onCancel} variant="secondary">Cancel</Button>
          </Actions>
        </>
      )}
    </Dialog>
  );
}
```

---

## Security Considerations

### PIN Security

1. **Hashing:** bcrypt with cost factor 10
2. **Rate Limiting:** 3 attempts, 5-minute lockout
3. **Weak PIN Detection:** Reject sequences and repetitions
4. **No Storage in Memory:** Clear PIN from memory after verification
5. **Secure Input:** Masked input, no copy/paste

### Biometric Security

1. **No Local Storage:** Never store biometric data locally
2. **OS APIs Only:** Use platform-provided biometric APIs
3. **Fallback Required:** Always provide PIN fallback
4. **Timeout:** 60-second timeout for biometric prompt
5. **Lockout Handling:** Handle biometric lockout gracefully

### Device Trust Security

1. **Limited Duration:** 7 days maximum
2. **Revocable:** Can be revoked remotely
3. **Device-Specific:** Tied to device ID
4. **Encrypted Storage:** Trust data encrypted at rest
5. **Audit Trail:** Log all trust events

---

## Implementation Guide

### Step 1: Set Up PIN Manager

```typescript
// Initialize PIN manager
const pinManager = new PINManager();

// Set up PIN during onboarding
await pinManager.setupPIN(userId, '123456');
```

### Step 2: Set Up Biometric Verifier

```typescript
// Get platform-specific biometric API
const biometricAPI = getBiometricAPI();

// Check availability
const available = await biometricAPI.isAvailable();

if (available) {
  const types = await biometricAPI.getSupportedTypes();
  console.log('Supported biometric types:', types);
}
```

### Step 3: Implement Verification Flow

```typescript
async function verifyUser(
  operation: string,
  userId: string,
  deviceId: string
): Promise<boolean> {
  // Check if verification is required
  const required = await shouldRequireVerification(operation, userId, deviceId);
  
  if (!required) {
    return true; // No verification needed
  }
  
  // Get operation sensitivity
  const sensitivity = getOperationSensitivity(operation);
  
  // Try biometric first for HIGH sensitivity
  if (sensitivity === SensitivityLevel.HIGH) {
    const biometricAvailable = await biometricAPI.isAvailable();
    
    if (biometricAvailable) {
      const result = await biometricAPI.authenticate({
        reason: `Verify to ${operation}`,
        fallbackEnabled: true,
        cancelable: true
      });
      
      if (result.success) {
        await recordVerification(userId);
        return true;
      }
      
      // Fall back to PIN if biometric fails
    }
  }
  
  // Use PIN verification
  const pinResult = await showPINEntry(userId);
  
  if (pinResult.success) {
    await recordVerification(userId);
    return true;
  }
  
  return false;
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('PINVerifier', () => {
  it('should verify correct PIN', async () => {
    await pinManager.setupPIN('user-1', '123456');
    const result = await pinVerifier.verifyPIN('user-1', '123456');
    expect(result.success).toBe(true);
  });
  
  it('should reject incorrect PIN', async () => {
    await pinManager.setupPIN('user-1', '123456');
    const result = await pinVerifier.verifyPIN('user-1', '654321');
    expect(result.success).toBe(false);
    expect(result.remainingAttempts).toBe(2);
  });
  
  it('should lock out after 3 failed attempts', async () => {
    await pinManager.setupPIN('user-1', '123456');
    
    await pinVerifier.verifyPIN('user-1', '000000');
    await pinVerifier.verifyPIN('user-1', '000000');
    const result = await pinVerifier.verifyPIN('user-1', '000000');
    
    expect(result.success).toBe(false);
    expect(result.reason).toBe('max_attempts');
  });
});
```

### Integration Tests

```typescript
describe('Verification Flow', () => {
  it('should require verification for sensitive operation', async () => {
    const required = await shouldRequireVerification('create_order', 'user-1', 'device-1');
    expect(required).toBe(true);
  });
  
  it('should skip verification for trusted device', async () => {
    await deviceTrustManager.trustDevice('user-1', 'device-1');
    await recordVerification('user-1');
    
    const required = await shouldRequireVerification('create_order', 'user-1', 'device-1');
    expect(required).toBe(false);
  });
});
```

---

## Platform-Specific Implementation

### Web (WebAuthn)

```typescript
// Check support
if (window.PublicKeyCredential) {
  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  console.log('WebAuthn available:', available);
}
```

### iOS (Swift)

```swift
import LocalAuthentication

let context = LAContext()
var error: NSError?

if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
    context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Verify your identity") { success, error in
        if success {
            print("Biometric authentication succeeded")
        }
    }
}
```

### Android (Kotlin)

```kotlin
val biometricManager = BiometricManager.from(context)

when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
    BiometricManager.BIOMETRIC_SUCCESS -> {
        // Biometric available
    }
    BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> {
        // No biometric hardware
    }
}
```

---

## Conclusion

WebWaka's offline re-verification mechanism ensures:

1. ✅ **Security without connectivity** - Verification works completely offline
2. ✅ **Tiered sensitivity** - Different operations require different verification levels
3. ✅ **User convenience** - Device trust reduces verification frequency
4. ✅ **Platform native** - Uses OS-provided biometric APIs
5. ✅ **No bypass** - Security cannot be circumvented

This mechanism balances security and usability for offline operations.

---

**Document Version:** 1.0  
**Last Updated:** February 1, 2026  
**Maintained By:** WebWaka Platform Team
