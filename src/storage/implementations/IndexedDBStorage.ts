/**
 * OFF-001 — IndexedDB Storage Implementation
 * 
 * This module implements the storage abstraction interface using IndexedDB
 * for web browsers. It provides persistent, structured storage with indexing
 * and query capabilities.
 * 
 * @module IndexedDBStorage
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import {
  IStorageAbstraction,
  StorageEntity,
  StorageMetadata,
  QueryOptions,
  QueryResult,
  SetOptions,
  DeleteResult,
  StorageStats,
  EncryptionHook,
  StorageError,
  StorageErrorCode,
  QueryCondition
} from '../interfaces/StorageAbstraction';
import { createHash } from 'crypto';

/**
 * IndexedDB configuration options
 */
export interface IndexedDBConfig {
  /** Database name */
  databaseName?: string;
  
  /** Database version */
  version?: number;
  
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * IndexedDB storage implementation
 */
export class IndexedDBStorage implements IStorageAbstraction {
  private db: IDBDatabase | null = null;
  private encryptionHook: EncryptionHook | null = null;
  private config: IndexedDBConfig = {
    databaseName: 'webwaka_offline_storage',
    version: 1,
    debug: false
  };
  private initialized = false;
  
  /**
   * Initialize IndexedDB storage
   */
  async initialize(config?: Record<string, any>): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    try {
      this.db = await this.openDatabase();
      this.initialized = true;
      this.log('IndexedDB storage initialized');
    } catch (error) {
      throw new StorageError(
        'Failed to initialize IndexedDB storage',
        StorageErrorCode.INITIALIZATION_FAILED,
        error
      );
    }
  }
  
  /**
   * Open IndexedDB database
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        this.config.databaseName!,
        this.config.version
      );
      
      request.onerror = () => {
        reject(new Error(`IndexedDB open failed: ${request.error}`));
      };
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores for collections
        // We use a dynamic approach: create stores as needed
        this.log('Database upgrade triggered');
      };
    });
  }
  
  /**
   * Ensure object store exists for collection
   */
  private async ensureObjectStore(collection: string): Promise<void> {
    if (!this.db) {
      throw new StorageError(
        'Storage not initialized',
        StorageErrorCode.NOT_INITIALIZED
      );
    }
    
    // Check if object store exists
    if (!this.db.objectStoreNames.contains(collection)) {
      // Need to upgrade database version
      const currentVersion = this.db.version;
      this.db.close();
      
      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(
          this.config.databaseName!,
          currentVersion + 1
        );
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          if (!db.objectStoreNames.contains(collection)) {
            const store = db.createObjectStore(collection, { keyPath: 'metadata.id' });
            
            // Create indexes for common queries
            store.createIndex('createdAt', 'metadata.createdAt', { unique: false });
            store.createIndex('updatedAt', 'metadata.updatedAt', { unique: false });
            store.createIndex('synced', 'metadata.synced', { unique: false });
            
            this.log(`Created object store: ${collection}`);
          }
        };
      });
    }
  }
  
  /**
   * Get entity by ID
   */
  async get<T = any>(collection: string, id: string): Promise<StorageEntity<T> | null> {
    this.ensureInitialized();
    await this.ensureObjectStore(collection);
    
    try {
      const transaction = this.db!.transaction([collection], 'readonly');
      const store = transaction.objectStore(collection);
      const request = store.get(id);
      
      const result = await this.promisifyRequest<StorageEntity<T>>(request);
      
      if (!result) {
        return null;
      }
      
      // Decrypt if encryption hook is set
      if (this.encryptionHook && result.data) {
        result.data = await this.encryptionHook.decrypt(result.data);
      }
      
      return result;
    } catch (error) {
      throw new StorageError(
        `Failed to get entity: ${id}`,
        StorageErrorCode.BACKEND_ERROR,
        error
      );
    }
  }
  
  /**
   * Set (create or update) entity
   */
  async set<T = any>(
    collection: string,
    id: string,
    data: T,
    options?: SetOptions
  ): Promise<StorageEntity<T>> {
    this.ensureInitialized();
    await this.ensureObjectStore(collection);
    
    try {
      // Get existing entity for merge
      let existing: StorageEntity<T> | null = null;
      if (options?.merge) {
        existing = await this.get<T>(collection, id);
      }
      
      // Prepare data
      let dataToStore = data;
      
      // Merge if requested
      if (options?.merge && existing) {
        dataToStore = { ...existing.data, ...data } as T;
      }
      
      // Encrypt if encryption hook is set
      if (this.encryptionHook) {
        dataToStore = await this.encryptionHook.encrypt(dataToStore) as any;
      }
      
      // Calculate hash
      const hash = this.calculateHash(dataToStore);
      
      // Create metadata
      const now = new Date().toISOString();
      const metadata: StorageMetadata = {
        id,
        createdAt: existing?.metadata.createdAt || now,
        updatedAt: now,
        version: options?.version || (existing?.metadata.version || 0) + 1,
        hash,
        synced: options?.synced || false,
        lastSyncedAt: options?.synced ? now : (existing?.metadata.lastSyncedAt || null)
      };
      
      // Create entity
      const entity: StorageEntity<T> = {
        data: dataToStore,
        metadata
      };
      
      // Store entity
      const transaction = this.db!.transaction([collection], 'readwrite');
      const store = transaction.objectStore(collection);
      const request = store.put(entity);
      
      await this.promisifyRequest(request);
      
      this.log(`Stored entity: ${collection}/${id}`);
      
      // Return entity with decrypted data
      return {
        data: data, // Return original unencrypted data
        metadata
      };
    } catch (error) {
      throw new StorageError(
        `Failed to set entity: ${id}`,
        StorageErrorCode.BACKEND_ERROR,
        error
      );
    }
  }
  
  /**
   * Query entities
   */
  async query<T = any>(
    collection: string,
    options?: QueryOptions
  ): Promise<QueryResult<T>> {
    this.ensureInitialized();
    await this.ensureObjectStore(collection);
    
    try {
      const transaction = this.db!.transaction([collection], 'readonly');
      const store = transaction.objectStore(collection);
      const request = store.getAll();
      
      let entities = await this.promisifyRequest<StorageEntity<T>[]>(request);
      
      // Decrypt entities
      if (this.encryptionHook) {
        entities = await Promise.all(
          entities.map(async (entity) => ({
            ...entity,
            data: await this.encryptionHook!.decrypt(entity.data)
          }))
        );
      }
      
      // Apply filters
      if (options?.conditions && options.conditions.length > 0) {
        entities = entities.filter((entity) =>
          this.matchesConditions(entity, options.conditions!)
        );
      }
      
      const totalCount = entities.length;
      
      // Apply sorting
      if (options?.sort && options.sort.length > 0) {
        entities = this.sortEntities(entities, options.sort);
      }
      
      // Apply pagination
      const offset = options?.offset || 0;
      const limit = options?.limit || entities.length;
      const paginatedEntities = entities.slice(offset, offset + limit);
      
      return {
        entities: paginatedEntities,
        totalCount,
        hasMore: offset + limit < totalCount
      };
    } catch (error) {
      throw new StorageError(
        `Failed to query collection: ${collection}`,
        StorageErrorCode.BACKEND_ERROR,
        error
      );
    }
  }
  
  /**
   * Delete entity by ID
   */
  async delete(collection: string, id: string): Promise<DeleteResult> {
    this.ensureInitialized();
    await this.ensureObjectStore(collection);
    
    try {
      // Check if entity exists
      const existing = await this.get(collection, id);
      
      if (!existing) {
        return { deleted: false, id };
      }
      
      // Delete entity
      const transaction = this.db!.transaction([collection], 'readwrite');
      const store = transaction.objectStore(collection);
      const request = store.delete(id);
      
      await this.promisifyRequest(request);
      
      this.log(`Deleted entity: ${collection}/${id}`);
      
      return { deleted: true, id };
    } catch (error) {
      throw new StorageError(
        `Failed to delete entity: ${id}`,
        StorageErrorCode.BACKEND_ERROR,
        error
      );
    }
  }
  
  /**
   * Clear all entities in collection
   */
  async clear(collection: string): Promise<number> {
    this.ensureInitialized();
    await this.ensureObjectStore(collection);
    
    try {
      // Get count before clearing
      const result = await this.query(collection);
      const count = result.totalCount;
      
      // Clear collection
      const transaction = this.db!.transaction([collection], 'readwrite');
      const store = transaction.objectStore(collection);
      const request = store.clear();
      
      await this.promisifyRequest(request);
      
      this.log(`Cleared collection: ${collection} (${count} entities)`);
      
      return count;
    } catch (error) {
      throw new StorageError(
        `Failed to clear collection: ${collection}`,
        StorageErrorCode.BACKEND_ERROR,
        error
      );
    }
  }
  
  /**
   * Clear all data (secure wipe)
   */
  async clearAll(): Promise<number> {
    this.ensureInitialized();
    
    try {
      let totalCount = 0;
      
      // Clear each object store
      const storeNames = Array.from(this.db!.objectStoreNames);
      
      for (const storeName of storeNames) {
        const count = await this.clear(storeName);
        totalCount += count;
      }
      
      this.log(`Cleared all data (${totalCount} entities)`);
      
      return totalCount;
    } catch (error) {
      throw new StorageError(
        'Failed to clear all data',
        StorageErrorCode.BACKEND_ERROR,
        error
      );
    }
  }
  
  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    this.ensureInitialized();
    
    try {
      let entityCount = 0;
      let unsyncedCount = 0;
      
      const storeNames = Array.from(this.db!.objectStoreNames);
      
      for (const storeName of storeNames) {
        const result = await this.query(storeName);
        entityCount += result.totalCount;
        
        const unsyncedResult = await this.query(storeName, {
          conditions: [{ field: 'metadata.synced', operator: 'eq', value: false }]
        });
        unsyncedCount += unsyncedResult.totalCount;
      }
      
      // Estimate storage size
      const estimate = await navigator.storage?.estimate?.();
      
      return {
        entityCount,
        sizeBytes: estimate?.usage || 0,
        unsyncedCount,
        backend: 'IndexedDB',
        quotaBytes: estimate?.quota || null,
        availableBytes: estimate?.quota && estimate?.usage
          ? estimate.quota - estimate.usage
          : null
      };
    } catch (error) {
      throw new StorageError(
        'Failed to get storage stats',
        StorageErrorCode.BACKEND_ERROR,
        error
      );
    }
  }
  
  /**
   * Set encryption hook
   */
  setEncryptionHook(hook: EncryptionHook): void {
    this.encryptionHook = hook;
    this.log('Encryption hook set');
  }
  
  /**
   * Close storage
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
      this.log('Storage closed');
    }
  }
  
  // Helper methods
  
  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new StorageError(
        'Storage not initialized. Call initialize() first.',
        StorageErrorCode.NOT_INITIALIZED
      );
    }
  }
  
  private promisifyRequest<T>(request: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  private calculateHash(data: any): string {
    const json = JSON.stringify(data);
    return createHash('sha256').update(json).digest('hex');
  }
  
  private matchesConditions(entity: StorageEntity, conditions: QueryCondition[]): boolean {
    return conditions.every((condition) => {
      const value = this.getNestedValue(entity, condition.field);
      return this.evaluateCondition(value, condition.operator, condition.value);
    });
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  private evaluateCondition(value: any, operator: string, compareValue: any): boolean {
    switch (operator) {
      case 'eq': return value === compareValue;
      case 'ne': return value !== compareValue;
      case 'gt': return value > compareValue;
      case 'gte': return value >= compareValue;
      case 'lt': return value < compareValue;
      case 'lte': return value <= compareValue;
      case 'in': return Array.isArray(compareValue) && compareValue.includes(value);
      case 'nin': return Array.isArray(compareValue) && !compareValue.includes(value);
      case 'contains': return typeof value === 'string' && value.includes(compareValue);
      case 'startsWith': return typeof value === 'string' && value.startsWith(compareValue);
      case 'endsWith': return typeof value === 'string' && value.endsWith(compareValue);
      default: return false;
    }
  }
  
  private sortEntities<T>(entities: StorageEntity<T>[], sortSpecs: any[]): StorageEntity<T>[] {
    return entities.sort((a, b) => {
      for (const spec of sortSpecs) {
        const aValue = this.getNestedValue(a, spec.field);
        const bValue = this.getNestedValue(b, spec.field);
        
        if (aValue < bValue) return spec.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return spec.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
  
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[IndexedDBStorage] ${message}`);
    }
  }
}
