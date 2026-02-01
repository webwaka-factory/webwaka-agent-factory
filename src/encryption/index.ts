/**
 * OFF-002 — Offline Data Encryption Layer
 * 
 * Main module exports for the encryption layer.
 * Provides AES-256-GCM encryption with device-bound keys.
 * 
 * @module @webwaka/encryption-layer
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

// Export interfaces and types
export {
  IEncryptionService,
  EncryptionConfig,
  EncryptedData,
  KeyDerivationParams,
  SecureWipeOptions,
  EncryptionStats,
  EncryptionError,
  EncryptionErrorCode,
  PlatformCrypto
} from './interfaces/EncryptionService';

// Export implementations
export { WebEncryptionService } from './implementations/WebEncryptionService';
export { MobileEncryptionService } from './implementations/MobileEncryptionService';

// Export adapter
export {
  StorageEncryptionAdapter,
  createEncryptedStorage
} from './StorageEncryptionAdapter';

// Export factory function
export function createEncryptionService(
  platform: 'web' | 'mobile'
): IEncryptionService {
  if (platform === 'web') {
    return new WebEncryptionService();
  } else if (platform === 'mobile') {
    return new MobileEncryptionService();
  } else {
    throw new Error(`Unknown platform: ${platform}`);
  }
}

// Export version
export const VERSION = '1.0.0';
