/**
 * OFF-002 — Web Encryption Service Implementation
 * 
 * Implements AES-256-GCM encryption using browser SubtleCrypto API.
 * Provides secure encryption-at-rest for offline web data.
 * 
 * @module WebEncryptionService
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
  EncryptionErrorCode,
  KeyDerivationParams
} from '../interfaces/EncryptionService';

/**
 * Web encryption service using SubtleCrypto
 */
export class WebEncryptionService implements IEncryptionService {
  private cryptoKey: CryptoKey | null = null;
  private config: EncryptionConfig | null = null;
  private keyVersion: number = 1;
  private salt: Uint8Array | null = null;
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
    
    // Check platform support
    if (!window.crypto || !window.crypto.subtle) {
      throw new EncryptionError(
        'SubtleCrypto not available in this browser',
        EncryptionErrorCode.PLATFORM_NOT_SUPPORTED
      );
    }
    
    try {
      this.config = config;
      
      // Generate or retrieve salt
      this.salt = await this.getSalt();
      
      // Derive encryption key
      this.cryptoKey = await this.deriveKey(
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
    
    const startTime = performance.now();
    
    try {
      // Serialize plaintext to JSON
      const plaintextString = JSON.stringify(plaintext);
      const plaintextBytes = new TextEncoder().encode(plaintextString);
      
      // Generate random IV (12 bytes for GCM)
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt with AES-256-GCM
      const ciphertextBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128 // 16 bytes authentication tag
        },
        this.cryptoKey!,
        plaintextBytes
      );
      
      // Extract ciphertext and auth tag
      // In GCM mode, the auth tag is appended to the ciphertext
      const ciphertextBytes = new Uint8Array(ciphertextBuffer);
      const ciphertext = ciphertextBytes.slice(0, -16);
      const authTag = ciphertextBytes.slice(-16);
      
      // Create encrypted data container
      const encryptedData: EncryptedData = {
        ciphertext: this.base64Encode(ciphertext),
        iv: this.base64Encode(iv),
        authTag: this.base64Encode(authTag),
        algorithm: 'AES-256-GCM',
        encryptedAt: new Date().toISOString(),
        keyVersion: this.keyVersion
      };
      
      // Update statistics
      const endTime = performance.now();
      this.stats.encryptionCount++;
      this.stats.totalEncryptionTime += (endTime - startTime);
      
      this.log(`Encrypted data (${plaintextBytes.length} bytes -> ${ciphertext.length} bytes)`);
      
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
    
    const startTime = performance.now();
    
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
      const ciphertext = this.base64Decode(encryptedData.ciphertext);
      const iv = this.base64Decode(encryptedData.iv);
      const authTag = this.base64Decode(encryptedData.authTag);
      
      // Concatenate ciphertext and auth tag for GCM
      const ciphertextWithTag = new Uint8Array(ciphertext.length + authTag.length);
      ciphertextWithTag.set(ciphertext, 0);
      ciphertextWithTag.set(authTag, ciphertext.length);
      
      // Decrypt with AES-256-GCM
      const plaintextBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128
        },
        this.cryptoKey!,
        ciphertextWithTag
      );
      
      // Decode plaintext
      const plaintextString = new TextDecoder().decode(plaintextBuffer);
      const plaintext = JSON.parse(plaintextString);
      
      // Update statistics
      const endTime = performance.now();
      this.stats.decryptionCount++;
      this.stats.totalDecryptionTime += (endTime - startTime);
      
      this.log(`Decrypted data (${ciphertext.length} bytes -> ${plaintextBuffer.byteLength} bytes)`);
      
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
      this.salt = window.crypto.getRandomValues(new Uint8Array(32));
      
      // Derive new key
      this.cryptoKey = await this.deriveKey(
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
      
      // Store new salt
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
      // Convert Buffer to Uint8Array if needed
      const buffer = data instanceof Buffer ? new Uint8Array(data) : data;
      
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
          window.crypto.getRandomValues(buffer);
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
    if (this.cryptoKey) {
      // Clear key reference
      this.cryptoKey = null;
      
      // Clear salt
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
    salt: Uint8Array,
    iterations: number
  ): Promise<CryptoKey> {
    try {
      // Combine device ID and user ID as password
      const password = `${deviceId}:${userId}`;
      const passwordBytes = new TextEncoder().encode(password);
      
      // Import password as key material
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        passwordBytes,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );
      
      // Derive AES-256 key
      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: iterations,
          hash: 'SHA-256'
        },
        keyMaterial,
        {
          name: 'AES-GCM',
          length: 256
        },
        false, // Not extractable
        ['encrypt', 'decrypt']
      );
      
      return key;
    } catch (error) {
      throw new EncryptionError(
        'Key derivation failed',
        EncryptionErrorCode.KEY_DERIVATION_FAILED,
        error
      );
    }
  }
  
  /**
   * Get or generate salt
   */
  private async getSalt(): Promise<Uint8Array> {
    try {
      // Try to retrieve existing salt from IndexedDB
      const storedSalt = await this.retrieveSalt();
      
      if (storedSalt) {
        return storedSalt;
      }
      
      // Generate new salt (32 bytes)
      const salt = window.crypto.getRandomValues(new Uint8Array(32));
      
      // Store salt
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
   * Store salt in IndexedDB
   */
  private async storeSalt(salt: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WebWakaEncryption', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys');
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['keys'], 'readwrite');
        const store = transaction.objectStore('keys');
        
        store.put(salt, 'salt');
        
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }
  
  /**
   * Retrieve salt from IndexedDB
   */
  private async retrieveSalt(): Promise<Uint8Array | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WebWakaEncryption', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys');
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        
        if (!db.objectStoreNames.contains('keys')) {
          db.close();
          resolve(null);
          return;
        }
        
        const transaction = db.transaction(['keys'], 'readonly');
        const store = transaction.objectStore('keys');
        const getRequest = store.get('salt');
        
        getRequest.onsuccess = () => {
          db.close();
          resolve(getRequest.result || null);
        };
        
        getRequest.onerror = () => {
          db.close();
          reject(getRequest.error);
        };
      };
    });
  }
  
  /**
   * Base64 encode
   */
  private base64Encode(data: Uint8Array): string {
    const binary = String.fromCharCode(...data);
    return btoa(binary);
  }
  
  /**
   * Base64 decode
   */
  private base64Decode(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  
  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.cryptoKey) {
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
      console.log(`[WebEncryptionService] ${message}`);
    }
  }
}
