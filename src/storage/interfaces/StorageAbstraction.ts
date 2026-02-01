/**
 * OFF-001 — Local Offline Data Store Abstraction
 * 
 * This module defines the core storage abstraction interface for offline-first data persistence.
 * It provides a backend-agnostic API for CRUD operations with support for encryption,
 * querying, and metadata management.
 * 
 * @module StorageAbstraction
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

/**
 * Metadata attached to every stored entity
 */
export interface StorageMetadata {
  /** Unique identifier for the entity */
  id: string;
  
  /** Timestamp when entity was created (ISO 8601) */
  createdAt: string;
  
  /** Timestamp when entity was last updated (ISO 8601) */
  updatedAt: string;
  
  /** Schema version for migration support */
  version: number;
  
  /** SHA-256 hash of the data for integrity verification */
  hash: string;
  
  /** Whether this entity has been synced to server */
  synced: boolean;
  
  /** Timestamp of last successful sync (ISO 8601, null if never synced) */
  lastSyncedAt: string | null;
}

/**
 * Stored entity with data and metadata
 */
export interface StorageEntity<T = any> {
  /** The actual data payload */
  data: T;
  
  /** Metadata for tracking and integrity */
  metadata: StorageMetadata;
}

/**
 * Query operators for filtering data
 */
export type QueryOperator = 
  | 'eq'      // Equal
  | 'ne'      // Not equal
  | 'gt'      // Greater than
  | 'gte'     // Greater than or equal
  | 'lt'      // Less than
  | 'lte'     // Less than or equal
  | 'in'      // In array
  | 'nin'     // Not in array
  | 'contains' // String contains
  | 'startsWith' // String starts with
  | 'endsWith';  // String ends with

/**
 * Query condition for filtering
 */
export interface QueryCondition {
  /** Field path (supports nested fields with dot notation) */
  field: string;
  
  /** Comparison operator */
  operator: QueryOperator;
  
  /** Value to compare against */
  value: any;
}

/**
 * Sort direction for query results
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort specification for query results
 */
export interface SortSpec {
  /** Field to sort by */
  field: string;
  
  /** Sort direction */
  direction: SortDirection;
}

/**
 * Query options for filtering and pagination
 */
export interface QueryOptions {
  /** Array of conditions (AND logic) */
  conditions?: QueryCondition[];
  
  /** Sort specifications (applied in order) */
  sort?: SortSpec[];
  
  /** Maximum number of results to return */
  limit?: number;
  
  /** Number of results to skip (for pagination) */
  offset?: number;
  
  /** Fields to include in results (null = all fields) */
  fields?: string[] | null;
}

/**
 * Result of a query operation
 */
export interface QueryResult<T = any> {
  /** Array of matching entities */
  entities: StorageEntity<T>[];
  
  /** Total count of matching entities (before limit/offset) */
  totalCount: number;
  
  /** Whether there are more results available */
  hasMore: boolean;
}

/**
 * Options for set/update operations
 */
export interface SetOptions {
  /** Whether to merge with existing data (true) or replace (false) */
  merge?: boolean;
  
  /** Custom version number (auto-increments if not provided) */
  version?: number;
  
  /** Mark as synced immediately */
  synced?: boolean;
}

/**
 * Result of a delete operation
 */
export interface DeleteResult {
  /** Whether the entity was found and deleted */
  deleted: boolean;
  
  /** ID of the deleted entity */
  id: string;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  /** Total number of entities stored */
  entityCount: number;
  
  /** Total size in bytes (approximate) */
  sizeBytes: number;
  
  /** Number of entities not yet synced */
  unsyncedCount: number;
  
  /** Storage backend name */
  backend: string;
  
  /** Storage quota limit in bytes (null if unlimited) */
  quotaBytes: number | null;
  
  /** Available space in bytes (null if unknown) */
  availableBytes: number | null;
}

/**
 * Encryption hook interface (implemented by OFF-002)
 */
export interface EncryptionHook {
  /**
   * Encrypt data before storage
   * @param data - Plain data to encrypt
   * @returns Encrypted data
   */
  encrypt(data: any): Promise<string>;
  
  /**
   * Decrypt data after retrieval
   * @param encryptedData - Encrypted data
   * @returns Decrypted data
   */
  decrypt(encryptedData: string): Promise<any>;
}

/**
 * Core storage abstraction interface
 * 
 * This interface must be implemented by all storage backends (IndexedDB, SQLite, etc.)
 * It provides a consistent API for offline data persistence with encryption support.
 */
export interface IStorageAbstraction {
  /**
   * Initialize the storage backend
   * Must be called before any other operations
   * 
   * @param config - Backend-specific configuration
   * @throws {StorageError} If initialization fails
   */
  initialize(config?: Record<string, any>): Promise<void>;
  
  /**
   * Get an entity by ID
   * 
   * @param collection - Collection/table name
   * @param id - Entity ID
   * @returns The entity or null if not found
   * @throws {StorageError} If operation fails
   */
  get<T = any>(collection: string, id: string): Promise<StorageEntity<T> | null>;
  
  /**
   * Set (create or update) an entity
   * 
   * @param collection - Collection/table name
   * @param id - Entity ID
   * @param data - Entity data
   * @param options - Set options
   * @returns The stored entity with metadata
   * @throws {StorageError} If operation fails
   */
  set<T = any>(
    collection: string,
    id: string,
    data: T,
    options?: SetOptions
  ): Promise<StorageEntity<T>>;
  
  /**
   * Query entities with filtering and pagination
   * 
   * @param collection - Collection/table name
   * @param options - Query options
   * @returns Query results
   * @throws {StorageError} If operation fails
   */
  query<T = any>(
    collection: string,
    options?: QueryOptions
  ): Promise<QueryResult<T>>;
  
  /**
   * Delete an entity by ID
   * 
   * @param collection - Collection/table name
   * @param id - Entity ID
   * @returns Delete result
   * @throws {StorageError} If operation fails
   */
  delete(collection: string, id: string): Promise<DeleteResult>;
  
  /**
   * Clear all entities in a collection
   * 
   * @param collection - Collection/table name
   * @returns Number of entities deleted
   * @throws {StorageError} If operation fails
   */
  clear(collection: string): Promise<number>;
  
  /**
   * Clear all data in all collections (secure wipe)
   * 
   * @returns Total number of entities deleted
   * @throws {StorageError} If operation fails
   */
  clearAll(): Promise<number>;
  
  /**
   * Get storage statistics
   * 
   * @returns Storage statistics
   * @throws {StorageError} If operation fails
   */
  getStats(): Promise<StorageStats>;
  
  /**
   * Set encryption hook (called by OFF-002)
   * 
   * @param hook - Encryption hook implementation
   */
  setEncryptionHook(hook: EncryptionHook): void;
  
  /**
   * Close the storage backend and release resources
   * 
   * @throws {StorageError} If operation fails
   */
  close(): Promise<void>;
}

/**
 * Custom error class for storage operations
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Storage error codes
 */
export enum StorageErrorCode {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  INVALID_QUERY = 'INVALID_QUERY',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
  BACKEND_ERROR = 'BACKEND_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
