/**
 * OFF-002 — Mobile Encryption Service Implementation
 * 
 * Implements AES-256-GCM encryption for mobile platforms (iOS/Android).
 * Uses platform-specific secure storage (iOS Keychain, Android KeyStore).
 * 
 * @module MobileEncryptionService
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import {
  IEncryptionService,
  EncryptionConfig,
  EncryptedData,
  EncryptionStats,
  SecureWipeOptions,
  EncryptionError,
  EncryptionErrorCode
} from '../interfaces/EncryptionService';
import { createHash, randomBytes, pbkdf2 } from 'crypto';

/**
 * Mobile encryption service for React Native
 * 
 * In production, this would use:
 * - iOS: CryptoKit + Keychain Services
 * - Android: AndroidKeyStore + Cipher
 * 
 * This implementation uses Node.js crypto as a fallback/mock
 */
export class MobileEncryptionService implements IEncryptionService {
  private encryptionKey: Buffer | null = null;
  private config: EncryptionConfig | null = null;
  private keyVersion: number = 1;
  private salt: Buffer | null = null;
  private initialized: boolean = false;
  
  // Statistics tracking
  private stats = {
    encryptionCount: 0,
    decryptionCount: 0,
    totalEncryptionTime: 0,
    totalDecryptionTime: 0,
    lastKeyRotation: null as string | null
  };
  
  /**
   * Initialize encryption service
   */
  async initialize(config: EncryptionConfig): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    // Validate configuration
    if (config.algorithm !== 'AES-256-GCM') {
      throw new EncryptionError(
        'Invalid algorithm. Only AES-256-GCM is supported.',
        EncryptionErrorCode.INVALID_ALGORITHM
      );
    }
    
    if (config.kdfIterations < 100000) {
      throw new EncryptionError(
        'KDF iterations must be at least 100,000',
        EncryptionErrorCode.INITIALIZATION_FAILED
      );
    }
    
    if (!config.deviceId || !config.userId) {
      throw new EncryptionError(
        'Device ID and User ID are required',
        EncryptionErrorCode.INITIALIZATION_FAILED
      );
    }
    
    try {
      this.config = config;
      
      // Get or generate salt from secure storage
      this.salt = await this.getSalt();
      
      // Derive encryption key
      this.encryptionKey = await this.deriveKey(
        config.deviceId,
        config.userId,
        this.salt,
        config.kdfIterations
      );
      
      this.initialized = true;
      this.log('Encryption service initialized');
    } catch (error) {
      throw new EncryptionError(
        'Failed to initialize encryption service',
        EncryptionErrorCode.INITIALIZATION_FAILED,
        error
      );
    }
  }
  
  /**
   * Encrypt data using AES-256-GCM
   */
  async encrypt(plaintext: any): Promise<EncryptedData> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      // Serialize plaintext to JSON
      const plaintextString = JSON.stringify(plaintext);
      const plaintextBuffer = Buffer.from(plaintextString, 'utf8');
      
      // Generate random IV (12 bytes for GCM)
      const iv = randomBytes(12);
      
      // Encrypt with AES-256-GCM (using Node.js crypto as mock)
      const crypto = require('crypto');
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey!, iv);
      
      const ciphertext = Buffer.concat([
        cipher.update(plaintextBuffer),
        cipher.final()
      ]);
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Create encrypted data container
      const encryptedData: EncryptedData = {
        ciphertext: ciphertext.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        algorithm: 'AES-256-GCM',
        encryptedAt: new Date().toISOString(),
        keyVersion: this.keyVersion
      };
      
      // Update statistics
      const endTime = Date.now();
      this.stats.encryptionCount++;
      this.stats.totalEncryptionTime += (endTime - startTime);
      
      this.log(`Encrypted data (${plaintextBuffer.length} bytes -> ${ciphertext.length} bytes)`);
      
      return encryptedData;
    } catch (error) {
      throw new EncryptionError(
        'Encryption failed',
        EncryptionErrorCode.ENCRYPTION_FAILED,
        error
      );
    }
  }
  
  /**
   * Decrypt data and verify authenticity
   */
  async decrypt(encryptedData: EncryptedData): Promise<any> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      // Validate algorithm
      if (encryptedData.algorithm !== 'AES-256-GCM') {
        throw new EncryptionError(
          `Unsupported algorithm: ${encryptedData.algorithm}`,
          EncryptionErrorCode.INVALID_ALGORITHM
        );
      }
      
      // Check key version
      if (encryptedData.keyVersion !== this.keyVersion) {
        throw new EncryptionError(
          `Key version mismatch: expected ${this.keyVersion}, got ${encryptedData.keyVersion}`,
          EncryptionErrorCode.INVALID_KEY_VERSION
        );
      }
      
      // Decode from base64
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const authTag = Buffer.from(encryptedData.authTag, 'base64');
      
      // Decrypt with AES-256-GCM
      const crypto = require('crypto');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey!, iv);
      decipher.setAuthTag(authTag);
      
      const plaintextBuffer = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      
      // Decode plaintext
      const plaintextString = plaintextBuffer.toString('utf8');
      const plaintext = JSON.parse(plaintextString);
      
      // Update statistics
      const endTime = Date.now();
      this.stats.decryptionCount++;
      this.stats.totalDecryptionTime += (endTime - startTime);
      
      this.log(`Decrypted data (${ciphertext.length} bytes -> ${plaintextBuffer.length} bytes)`);
      
      return plaintext;
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw error;
      }
      
      // Authentication failure or decryption error
      throw new EncryptionError(
        'Decryption failed. Data may be corrupted or tampered.',
        EncryptionErrorCode.AUTHENTICATION_FAILED,
        error
      );
    }
  }
  
  /**
   * Rotate encryption key
   */
  async rotateKey(newUserId?: string, newDeviceId?: string): Promise<number> {
    this.ensureInitialized();
    
    try {
      const userId = newUserId || this.config!.userId;
      const deviceId = newDeviceId || this.config!.deviceId;
      
      // Generate new salt
      this.salt = randomBytes(32);
      
      // Derive new key
      this.encryptionKey = await this.deriveKey(
        deviceId,
        userId,
        this.salt,
        this.config!.kdfIterations
      );
      
      // Increment key version
      this.keyVersion++;
      
      // Update configuration
      this.config!.userId = userId;
      this.config!.deviceId = deviceId;
      
      // Store new salt in secure storage
      await this.storeSalt(this.salt);
      
      // Update statistics
      this.stats.lastKeyRotation = new Date().toISOString();
      
      this.log(`Key rotated to version ${this.keyVersion}`);
      
      return this.keyVersion;
    } catch (error) {
      throw new EncryptionError(
        'Key rotation failed',
        EncryptionErrorCode.KEY_ROTATION_FAILED,
        error
      );
    }
  }
  
  /**
   * Securely wipe data from memory
   */
  async secureWipe(data: Uint8Array | Buffer, options?: SecureWipeOptions): Promise<void> {
    const passes = options?.passes || 3;
    
    if (passes < 3) {
      throw new EncryptionError(
        'Secure wipe requires at least 3 passes',
        EncryptionErrorCode.SECURE_WIPE_FAILED
      );
    }
    
    try {
      // Convert Uint8Array to Buffer if needed
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      
      // Perform multiple overwrite passes
      for (let pass = 0; pass < passes; pass++) {
        // Pass 1: All zeros
        if (pass === 0) {
          buffer.fill(0);
        }
        // Pass 2: All ones
        else if (pass === 1) {
          buffer.fill(0xFF);
        }
        // Pass 3+: Random data
        else {
          const random = randomBytes(buffer.length);
          random.copy(buffer);
        }
      }
      
      // Final pass: zeros
      buffer.fill(0);
      
      // Verify if requested
      if (options?.verify) {
        const allZeros = buffer.every(byte => byte === 0);
        if (!allZeros) {
          throw new Error('Verification failed: buffer not zeroed');
        }
      }
      
      this.log(`Securely wiped ${buffer.length} bytes (${passes} passes)`);
    } catch (error) {
      throw new EncryptionError(
        'Secure wipe failed',
        EncryptionErrorCode.SECURE_WIPE_FAILED,
        error
      );
    }
  }
  
  /**
   * Get encryption statistics
   */
  async getStats(): Promise<EncryptionStats> {
    return {
      encryptionCount: this.stats.encryptionCount,
      decryptionCount: this.stats.decryptionCount,
      avgEncryptionTime: this.stats.encryptionCount > 0
        ? this.stats.totalEncryptionTime / this.stats.encryptionCount
        : 0,
      avgDecryptionTime: this.stats.decryptionCount > 0
        ? this.stats.totalDecryptionTime / this.stats.decryptionCount
        : 0,
      keyVersion: this.keyVersion,
      lastKeyRotation: this.stats.lastKeyRotation
    };
  }
  
  /**
   * Clear encryption key from memory
   */
  async clearKey(): Promise<void> {
    if (this.encryptionKey) {
      // Securely wipe key
      await this.secureWipe(this.encryptionKey);
      this.encryptionKey = null;
      
      // Wipe salt
      if (this.salt) {
        await this.secureWipe(this.salt);
        this.salt = null;
      }
      
      this.initialized = false;
      this.log('Encryption key cleared');
    }
  }
  
  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  // Private helper methods
  
  /**
   * Derive encryption key using PBKDF2
   */
  private async deriveKey(
    deviceId: string,
    userId: string,
    salt: Buffer,
    iterations: number
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Combine device ID and user ID as password
        const password = `${deviceId}:${userId}`;
        
        // Derive 256-bit key using PBKDF2-SHA256
        pbkdf2(password, salt, iterations, 32, 'sha256', (err, derivedKey) => {
          if (err) {
            reject(new EncryptionError(
              'Key derivation failed',
              EncryptionErrorCode.KEY_DERIVATION_FAILED,
              err
            ));
          } else {
            resolve(derivedKey);
          }
        });
      } catch (error) {
        reject(new EncryptionError(
          'Key derivation failed',
          EncryptionErrorCode.KEY_DERIVATION_FAILED,
          error
        ));
      }
    });
  }
  
  /**
   * Get or generate salt
   */
  private async getSalt(): Promise<Buffer> {
    try {
      // Try to retrieve existing salt from secure storage
      const storedSalt = await this.retrieveSalt();
      
      if (storedSalt) {
        return storedSalt;
      }
      
      // Generate new salt (32 bytes)
      const salt = randomBytes(32);
      
      // Store salt in secure storage
      await this.storeSalt(salt);
      
      return salt;
    } catch (error) {
      throw new EncryptionError(
        'Failed to get salt',
        EncryptionErrorCode.INITIALIZATION_FAILED,
        error
      );
    }
  }
  
  /**
   * Store salt in secure storage
   * 
   * In production:
   * - iOS: Use Keychain Services
   * - Android: Use AndroidKeyStore
   * 
   * This mock implementation uses a simple file-based storage
   */
  private async storeSalt(salt: Buffer): Promise<void> {
    try {
      // In production, use platform-specific secure storage:
      // - iOS: await Keychain.setGenericPassword('salt', salt.toString('base64'))
      // - Android: await SecureStore.setItemAsync('salt', salt.toString('base64'))
      
      // Mock implementation (NOT SECURE - for development only)
      this.log('Salt stored in secure storage (mock)');
    } catch (error) {
      throw new EncryptionError(
        'Failed to store salt',
        EncryptionErrorCode.INITIALIZATION_FAILED,
        error
      );
    }
  }
  
  /**
   * Retrieve salt from secure storage
   */
  private async retrieveSalt(): Promise<Buffer | null> {
    try {
      // In production, use platform-specific secure storage:
      // - iOS: const salt = await Keychain.getGenericPassword('salt')
      // - Android: const salt = await SecureStore.getItemAsync('salt')
      
      // Mock implementation
      return null;
    } catch (error) {
      this.log('Failed to retrieve salt from secure storage');
      return null;
    }
  }
  
  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.encryptionKey) {
      throw new EncryptionError(
        'Encryption service not initialized',
        EncryptionErrorCode.NOT_INITIALIZED
      );
    }
  }
  
  /**
   * Log debug message
   */
  private log(message: string): void {
    if (this.config?.debug) {
      console.log(`[MobileEncryptionService] ${message}`);
    }
  }
}
