/**
 * OFF-002 — Offline Data Encryption Layer
 * 
 * This module defines the encryption service interface for secure offline data storage.
 * Implements AES-256-GCM authenticated encryption with device-bound keys.
 * 
 * @module EncryptionService
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  /** Algorithm to use (must be AES-256-GCM) */
  algorithm: 'AES-256-GCM';
  
  /** Key derivation function iterations (minimum 100,000) */
  kdfIterations: number;
  
  /** Device identifier for key binding */
  deviceId: string;
  
  /** User identifier for key binding */
  userId: string;
  
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Encrypted data container
 */
export interface EncryptedData {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  
  /** Base64-encoded initialization vector (12 bytes for GCM) */
  iv: string;
  
  /** Base64-encoded authentication tag (16 bytes for GCM) */
  authTag: string;
  
  /** Algorithm used for encryption */
  algorithm: string;
  
  /** Timestamp when encrypted (ISO 8601) */
  encryptedAt: string;
  
  /** Key version for rotation support */
  keyVersion: number;
}

/**
 * Key derivation parameters
 */
export interface KeyDerivationParams {
  /** Salt for KDF (random, 32 bytes) */
  salt: Uint8Array;
  
  /** Number of iterations */
  iterations: number;
  
  /** Hash algorithm for PBKDF2 */
  hashAlgorithm: 'SHA-256' | 'SHA-512';
  
  /** Derived key length in bytes */
  keyLength: number;
}

/**
 * Secure wipe options
 */
export interface SecureWipeOptions {
  /** Number of overwrite passes (minimum 3) */
  passes: number;
  
  /** Verify wipe completion */
  verify?: boolean;
}

/**
 * Encryption statistics
 */
export interface EncryptionStats {
  /** Total number of encryption operations */
  encryptionCount: number;
  
  /** Total number of decryption operations */
  decryptionCount: number;
  
  /** Average encryption time in milliseconds */
  avgEncryptionTime: number;
  
  /** Average decryption time in milliseconds */
  avgDecryptionTime: number;
  
  /** Current key version */
  keyVersion: number;
  
  /** Last key rotation timestamp (ISO 8601) */
  lastKeyRotation: string | null;
}

/**
 * Core encryption service interface
 */
export interface IEncryptionService {
  /**
   * Initialize the encryption service
   * Derives encryption key from device and user identifiers
   * 
   * @param config - Encryption configuration
   * @throws {EncryptionError} If initialization fails
   */
  initialize(config: EncryptionConfig): Promise<void>;
  
  /**
   * Encrypt data using AES-256-GCM
   * 
   * @param plaintext - Data to encrypt (any JSON-serializable value)
   * @returns Encrypted data container
   * @throws {EncryptionError} If encryption fails
   */
  encrypt(plaintext: any): Promise<EncryptedData>;
  
  /**
   * Decrypt data and verify authenticity
   * 
   * @param encryptedData - Encrypted data container
   * @returns Decrypted plaintext
   * @throws {EncryptionError} If decryption or verification fails
   */
  decrypt(encryptedData: EncryptedData): Promise<any>;
  
  /**
   * Rotate encryption key
   * Re-derives key from updated user/device identifiers
   * 
   * @param newUserId - New user identifier (optional)
   * @param newDeviceId - New device identifier (optional)
   * @returns New key version
   * @throws {EncryptionError} If rotation fails
   */
  rotateKey(newUserId?: string, newDeviceId?: string): Promise<number>;
  
  /**
   * Securely wipe data from memory
   * Overwrites data multiple times before deletion
   * 
   * @param data - Data to wipe (Buffer or Uint8Array)
   * @param options - Wipe options
   * @throws {EncryptionError} If wipe fails
   */
  secureWipe(data: Uint8Array | Buffer, options?: SecureWipeOptions): Promise<void>;
  
  /**
   * Get encryption statistics
   * 
   * @returns Encryption statistics
   */
  getStats(): Promise<EncryptionStats>;
  
  /**
   * Clear encryption key from memory
   * Should be called when user logs out
   * 
   * @throws {EncryptionError} If cleanup fails
   */
  clearKey(): Promise<void>;
  
  /**
   * Check if service is initialized and ready
   * 
   * @returns True if initialized
   */
  isInitialized(): boolean;
}

/**
 * Custom error class for encryption operations
 */
export class EncryptionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Encryption error codes
 */
export enum EncryptionErrorCode {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  KEY_DERIVATION_FAILED = 'KEY_DERIVATION_FAILED',
  KEY_ROTATION_FAILED = 'KEY_ROTATION_FAILED',
  SECURE_WIPE_FAILED = 'SECURE_WIPE_FAILED',
  INVALID_ALGORITHM = 'INVALID_ALGORITHM',
  INVALID_KEY_VERSION = 'INVALID_KEY_VERSION',
  PLATFORM_NOT_SUPPORTED = 'PLATFORM_NOT_SUPPORTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Platform crypto capabilities
 */
export interface PlatformCrypto {
  /** Platform name */
  platform: 'web' | 'ios' | 'android' | 'unknown';
  
  /** Whether platform crypto is available */
  available: boolean;
  
  /** Supported algorithms */
  supportedAlgorithms: string[];
  
  /** Whether secure storage is available */
  secureStorageAvailable: boolean;
}
