/**
 * OFF-001 — Local Offline Data Store Abstraction
 * 
 * Main module exports for the storage abstraction layer.
 * Provides unified interface for offline-first data persistence.
 * 
 * @module @webwaka/storage-abstraction
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

// Export interfaces and types
export {
  IStorageAbstraction,
  StorageEntity,
  StorageMetadata,
  QueryOptions,
  QueryResult,
  QueryCondition,
  QueryOperator,
  SortSpec,
  SortDirection,
  SetOptions,
  DeleteResult,
  StorageStats,
  EncryptionHook,
  StorageError,
  StorageErrorCode
} from './interfaces/StorageAbstraction';

// Export implementations
export { IndexedDBStorage } from './implementations/IndexedDBStorage';
export type { IndexedDBConfig } from './implementations/IndexedDBStorage';

export { SQLiteStorage } from './implementations/SQLiteStorage';
export type { SQLiteConfig } from './implementations/SQLiteStorage';

// Export factory function for creating storage instances
export function createStorage(
  backend: 'indexeddb' | 'sqlite',
  config?: Record<string, any>
): IStorageAbstraction {
  if (backend === 'indexeddb') {
    return new IndexedDBStorage();
  } else if (backend === 'sqlite') {
    return new SQLiteStorage();
  } else {
    throw new Error(`Unknown storage backend: ${backend}`);
  }
}

// Export version
export const VERSION = '1.0.0';
