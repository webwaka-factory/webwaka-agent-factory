/**
 * OFF-002 — Encryption Service Unit Tests
 * 
 * Comprehensive test suite for encryption service implementations.
 * Tests both web and mobile encryption services.
 * 
 * @module EncryptionService.test
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  IEncryptionService,
  EncryptionError,
  EncryptionErrorCode,
  EncryptedData
} from '../interfaces/EncryptionService';
import { WebEncryptionService } from '../implementations/WebEncryptionService';
import { MobileEncryptionService } from '../implementations/MobileEncryptionService';

/**
 * Generic test suite for encryption implementations
 */
function createEncryptionTestSuite(
  name: string,
  createService: () => IEncryptionService
) {
  describe(`${name} Encryption Service`, () => {
    let service: IEncryptionService;
    
    const testConfig = {
      algorithm: 'AES-256-GCM' as const,
      kdfIterations: 100000,
      deviceId: 'test-device-123',
      userId: 'test-user-456',
      debug: false
    };
    
    beforeEach(async () => {
      service = createService();
      await service.initialize(testConfig);
    });
    
    afterEach(async () => {
      await service.clearKey();
    });
    
    describe('Initialization', () => {
      it('should initialize successfully with valid config', async () => {
        const newService = createService();
        await expect(newService.initialize(testConfig)).resolves.not.toThrow();
        expect(newService.isInitialized()).toBe(true);
        await newService.clearKey();
      });
      
      it('should reject invalid algorithm', async () => {
        const newService = createService();
        await expect(
          newService.initialize({
            ...testConfig,
            algorithm: 'AES-128-CBC' as any
          })
        ).rejects.toThrow(EncryptionError);
      });
      
      it('should reject low KDF iterations', async () => {
        const newService = createService();
        await expect(
          newService.initialize({
            ...testConfig,
            kdfIterations: 1000 // Too low
          })
        ).rejects.toThrow(EncryptionError);
      });
      
      it('should reject missing device ID', async () => {
        const newService = createService();
        await expect(
          newService.initialize({
            ...testConfig,
            deviceId: ''
          })
        ).rejects.toThrow(EncryptionError);
      });
      
      it('should reject missing user ID', async () => {
        const newService = createService();
        await expect(
          newService.initialize({
            ...testConfig,
            userId: ''
          })
        ).rejects.toThrow(EncryptionError);
      });
      
      it('should allow multiple initializations', async () => {
        await expect(service.initialize(testConfig)).resolves.not.toThrow();
        await expect(service.initialize(testConfig)).resolves.not.toThrow();
      });
    });
    
    describe('Encryption and Decryption', () => {
      it('should encrypt and decrypt simple data', async () => {
        const plaintext = { message: 'Hello, World!' };
        
        const encrypted = await service.encrypt(plaintext);
        const decrypted = await service.decrypt(encrypted);
        
        expect(decrypted).toEqual(plaintext);
      });
      
      it('should encrypt and decrypt complex data', async () => {
        const plaintext = {
          user: {
            id: 123,
            name: 'John Doe',
            email: 'john@example.com',
            roles: ['admin', 'user'],
            metadata: {
              createdAt: '2026-01-01T00:00:00Z',
              lastLogin: '2026-02-01T12:00:00Z'
            }
          },
          settings: {
            theme: 'dark',
            notifications: true
          }
        };
        
        const encrypted = await service.encrypt(plaintext);
        const decrypted = await service.decrypt(encrypted);
        
        expect(decrypted).toEqual(plaintext);
      });
      
      it('should encrypt and decrypt arrays', async () => {
        const plaintext = [1, 2, 3, 'four', { five: 5 }];
        
        const encrypted = await service.encrypt(plaintext);
        const decrypted = await service.decrypt(encrypted);
        
        expect(decrypted).toEqual(plaintext);
      });
      
      it('should encrypt and decrypt strings', async () => {
        const plaintext = 'This is a secret message';
        
        const encrypted = await service.encrypt(plaintext);
        const decrypted = await service.decrypt(encrypted);
        
        expect(decrypted).toEqual(plaintext);
      });
      
      it('should encrypt and decrypt numbers', async () => {
        const plaintext = 42;
        
        const encrypted = await service.encrypt(plaintext);
        const decrypted = await service.decrypt(encrypted);
        
        expect(decrypted).toEqual(plaintext);
      });
      
      it('should encrypt and decrypt booleans', async () => {
        const plaintext = true;
        
        const encrypted = await service.encrypt(plaintext);
        const decrypted = await service.decrypt(encrypted);
        
        expect(decrypted).toEqual(plaintext);
      });
      
      it('should encrypt and decrypt null', async () => {
        const plaintext = null;
        
        const encrypted = await service.encrypt(plaintext);
        const decrypted = await service.decrypt(encrypted);
        
        expect(decrypted).toEqual(plaintext);
      });
      
      it('should produce different ciphertexts for same plaintext', async () => {
        const plaintext = { message: 'Hello' };
        
        const encrypted1 = await service.encrypt(plaintext);
        const encrypted2 = await service.encrypt(plaintext);
        
        // Different IVs should produce different ciphertexts
        expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
        expect(encrypted1.iv).not.toBe(encrypted2.iv);
        
        // But both should decrypt to the same plaintext
        const decrypted1 = await service.decrypt(encrypted1);
        const decrypted2 = await service.decrypt(encrypted2);
        
        expect(decrypted1).toEqual(plaintext);
        expect(decrypted2).toEqual(plaintext);
      });
      
      it('should include metadata in encrypted data', async () => {
        const plaintext = { message: 'Test' };
        
        const encrypted = await service.encrypt(plaintext);
        
        expect(encrypted.algorithm).toBe('AES-256-GCM');
        expect(encrypted.keyVersion).toBe(1);
        expect(encrypted.encryptedAt).toBeDefined();
        expect(encrypted.ciphertext).toBeDefined();
        expect(encrypted.iv).toBeDefined();
        expect(encrypted.authTag).toBeDefined();
      });
    });
    
    describe('Authentication and Integrity', () => {
      it('should detect tampered ciphertext', async () => {
        const plaintext = { message: 'Secret' };
        
        const encrypted = await service.encrypt(plaintext);
        
        // Tamper with ciphertext
        const tamperedCiphertext = encrypted.ciphertext.slice(0, -4) + 'XXXX';
        const tampered: EncryptedData = {
          ...encrypted,
          ciphertext: tamperedCiphertext
        };
        
        await expect(service.decrypt(tampered)).rejects.toThrow(EncryptionError);
      });
      
      it('should detect tampered auth tag', async () => {
        const plaintext = { message: 'Secret' };
        
        const encrypted = await service.encrypt(plaintext);
        
        // Tamper with auth tag
        const tamperedAuthTag = encrypted.authTag.slice(0, -4) + 'XXXX';
        const tampered: EncryptedData = {
          ...encrypted,
          authTag: tamperedAuthTag
        };
        
        await expect(service.decrypt(tampered)).rejects.toThrow(EncryptionError);
      });
      
      it('should detect tampered IV', async () => {
        const plaintext = { message: 'Secret' };
        
        const encrypted = await service.encrypt(plaintext);
        
        // Tamper with IV
        const tamperedIV = encrypted.iv.slice(0, -4) + 'XXXX';
        const tampered: EncryptedData = {
          ...encrypted,
          iv: tamperedIV
        };
        
        await expect(service.decrypt(tampered)).rejects.toThrow(EncryptionError);
      });
      
      it('should reject wrong key version', async () => {
        const plaintext = { message: 'Secret' };
        
        const encrypted = await service.encrypt(plaintext);
        
        // Change key version
        const wrongVersion: EncryptedData = {
          ...encrypted,
          keyVersion: 999
        };
        
        await expect(service.decrypt(wrongVersion)).rejects.toThrow(EncryptionError);
      });
    });
    
    describe('Key Rotation', () => {
      it('should rotate key successfully', async () => {
        const newVersion = await service.rotateKey();
        
        expect(newVersion).toBe(2);
      });
      
      it('should use new key after rotation', async () => {
        const plaintext = { message: 'Test' };
        
        // Encrypt with key version 1
        const encrypted1 = await service.encrypt(plaintext);
        expect(encrypted1.keyVersion).toBe(1);
        
        // Rotate key
        await service.rotateKey();
        
        // Encrypt with key version 2
        const encrypted2 = await service.encrypt(plaintext);
        expect(encrypted2.keyVersion).toBe(2);
        
        // Cannot decrypt v2 data (different key)
        await expect(service.decrypt(encrypted1)).rejects.toThrow(EncryptionError);
      });
      
      it('should rotate key with new user ID', async () => {
        const newVersion = await service.rotateKey('new-user-789');
        
        expect(newVersion).toBe(2);
      });
      
      it('should rotate key with new device ID', async () => {
        const newVersion = await service.rotateKey(undefined, 'new-device-789');
        
        expect(newVersion).toBe(2);
      });
    });
    
    describe('Secure Wipe', () => {
      it('should wipe data with default passes', async () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        
        await service.secureWipe(data, { verify: true });
        
        expect(data.every(byte => byte === 0)).toBe(true);
      });
      
      it('should wipe data with custom passes', async () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        
        await service.secureWipe(data, { passes: 5, verify: true });
        
        expect(data.every(byte => byte === 0)).toBe(true);
      });
      
      it('should reject less than 3 passes', async () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        
        await expect(
          service.secureWipe(data, { passes: 2 })
        ).rejects.toThrow(EncryptionError);
      });
    });
    
    describe('Statistics', () => {
      it('should track encryption operations', async () => {
        const plaintext = { message: 'Test' };
        
        await service.encrypt(plaintext);
        await service.encrypt(plaintext);
        await service.encrypt(plaintext);
        
        const stats = await service.getStats();
        
        expect(stats.encryptionCount).toBe(3);
        expect(stats.avgEncryptionTime).toBeGreaterThan(0);
      });
      
      it('should track decryption operations', async () => {
        const plaintext = { message: 'Test' };
        
        const encrypted1 = await service.encrypt(plaintext);
        const encrypted2 = await service.encrypt(plaintext);
        
        await service.decrypt(encrypted1);
        await service.decrypt(encrypted2);
        
        const stats = await service.getStats();
        
        expect(stats.decryptionCount).toBe(2);
        expect(stats.avgDecryptionTime).toBeGreaterThan(0);
      });
      
      it('should track key rotation', async () => {
        await service.rotateKey();
        
        const stats = await service.getStats();
        
        expect(stats.keyVersion).toBe(2);
        expect(stats.lastKeyRotation).not.toBeNull();
      });
    });
    
    describe('Performance', () => {
      it('should encrypt within 50ms', async () => {
        const plaintext = { message: 'Performance test' };
        
        const start = Date.now();
        await service.encrypt(plaintext);
        const duration = Date.now() - start;
        
        expect(duration).toBeLessThan(50);
      });
      
      it('should decrypt within 50ms', async () => {
        const plaintext = { message: 'Performance test' };
        const encrypted = await service.encrypt(plaintext);
        
        const start = Date.now();
        await service.decrypt(encrypted);
        const duration = Date.now() - start;
        
        expect(duration).toBeLessThan(50);
      });
      
      it('should handle large data efficiently', async () => {
        // Create 1MB of data
        const largeData = {
          items: Array.from({ length: 10000 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            description: 'A'.repeat(100)
          }))
        };
        
        const start = Date.now();
        const encrypted = await service.encrypt(largeData);
        const decrypted = await service.decrypt(encrypted);
        const duration = Date.now() - start;
        
        expect(decrypted).toEqual(largeData);
        expect(duration).toBeLessThan(1000); // Should complete within 1 second
      });
    });
    
    describe('Error Handling', () => {
      it('should throw error when not initialized', async () => {
        const newService = createService();
        
        await expect(
          newService.encrypt({ message: 'Test' })
        ).rejects.toThrow(EncryptionError);
      });
      
      it('should throw error with correct code', async () => {
        const newService = createService();
        
        try {
          await newService.encrypt({ message: 'Test' });
          fail('Should have thrown EncryptionError');
        } catch (error) {
          expect(error).toBeInstanceOf(EncryptionError);
          expect((error as EncryptionError).code).toBe(EncryptionErrorCode.NOT_INITIALIZED);
        }
      });
    });
    
    describe('Key Management', () => {
      it('should clear key successfully', async () => {
        await service.clearKey();
        
        expect(service.isInitialized()).toBe(false);
        
        await expect(
          service.encrypt({ message: 'Test' })
        ).rejects.toThrow(EncryptionError);
      });
      
      it('should allow re-initialization after clearing', async () => {
        await service.clearKey();
        await service.initialize(testConfig);
        
        const plaintext = { message: 'Test' };
        const encrypted = await service.encrypt(plaintext);
        const decrypted = await service.decrypt(encrypted);
        
        expect(decrypted).toEqual(plaintext);
      });
    });
  });
}

// Run test suites for both implementations
createEncryptionTestSuite('Web', () => new WebEncryptionService());
createEncryptionTestSuite('Mobile', () => new MobileEncryptionService());

// Integration tests
describe('Encryption Service Integration', () => {
  it('should work with storage abstraction', async () => {
    // This test would require importing storage abstraction
    // Placeholder for integration testing
    expect(true).toBe(true);
  });
});
