/**
 * OFF-002 — Storage Encryption Adapter
 * 
 * Integrates encryption service with storage abstraction (OFF-001).
 * Provides transparent encryption/decryption hooks for storage layer.
 * 
 * @module StorageEncryptionAdapter
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import { IEncryptionService, EncryptedData } from './interfaces/EncryptionService';
import { EncryptionHook } from '../storage/interfaces/StorageAbstraction';

/**
 * Adapter that connects encryption service to storage abstraction
 * 
 * Usage:
 * ```typescript
 * const encryptionService = new WebEncryptionService();
 * await encryptionService.initialize(config);
 * 
 * const adapter = new StorageEncryptionAdapter(encryptionService);
 * const hook = adapter.createHook();
 * 
 * storage.setEncryptionHook(hook);
 * ```
 */
export class StorageEncryptionAdapter {
  constructor(private encryptionService: IEncryptionService) {
    if (!encryptionService.isInitialized()) {
      throw new Error('Encryption service must be initialized before creating adapter');
    }
  }
  
  /**
   * Create encryption hook for storage abstraction
   */
  createHook(): EncryptionHook {
    return {
      encrypt: async (data: any): Promise<any> => {
        // Encrypt data and return encrypted container
        const encrypted = await this.encryptionService.encrypt(data);
        
        // Return encrypted data as serializable object
        return encrypted;
      },
      
      decrypt: async (encryptedData: any): Promise<any> => {
        // Decrypt data from encrypted container
        const decrypted = await this.encryptionService.decrypt(encryptedData as EncryptedData);
        
        return decrypted;
      }
    };
  }
  
  /**
   * Get the underlying encryption service
   */
  getEncryptionService(): IEncryptionService {
    return this.encryptionService;
  }
}

/**
 * Factory function to create storage with encryption
 */
export async function createEncryptedStorage(
  storageBackend: 'indexeddb' | 'sqlite',
  encryptionConfig: {
    deviceId: string;
    userId: string;
    kdfIterations?: number;
    debug?: boolean;
  }
): Promise<{
  storage: any; // IStorageAbstraction
  encryption: IEncryptionService;
}> {
  // Import dynamically to avoid circular dependencies
  const { createStorage } = await import('../storage/index');
  const { WebEncryptionService } = await import('./implementations/WebEncryptionService');
  const { MobileEncryptionService } = await import('./implementations/MobileEncryptionService');
  
  // Create storage instance
  const storage = createStorage(storageBackend);
  
  // Create encryption service
  const encryptionService = storageBackend === 'indexeddb'
    ? new WebEncryptionService()
    : new MobileEncryptionService();
  
  // Initialize encryption
  await encryptionService.initialize({
    algorithm: 'AES-256-GCM',
    kdfIterations: encryptionConfig.kdfIterations || 100000,
    deviceId: encryptionConfig.deviceId,
    userId: encryptionConfig.userId,
    debug: encryptionConfig.debug || false
  });
  
  // Create adapter and hook
  const adapter = new StorageEncryptionAdapter(encryptionService);
  const hook = adapter.createHook();
  
  // Initialize storage
  await storage.initialize();
  
  // Set encryption hook
  storage.setEncryptionHook(hook);
  
  return {
    storage,
    encryption: encryptionService
  };
}
