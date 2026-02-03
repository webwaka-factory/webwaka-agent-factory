/**
 * OFF-001 — SQLite Storage Implementation
 * 
 * This module implements the storage abstraction interface using SQLite
 * for mobile platforms (React Native). It provides persistent, structured
 * storage with SQL query capabilities.
 * 
 * @module SQLiteStorage
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
 * SQLite configuration options
 */
export interface SQLiteConfig {
  /** Database file path */
  databasePath?: string;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Enable WAL mode for better concurrency */
  enableWAL?: boolean;
}

/**
 * Mock SQLite database interface (to be replaced with actual implementation)
 * In production, this would use expo-sqlite or react-native-sqlite-storage
 */
interface SQLiteDatabase {
  executeSql(
    sql: string,
    params?: any[],
    success?: (tx: any, results: any) => void,
    error?: (tx: any, error: any) => void
  ): Promise<any>;
  transaction(callback: (tx: any) => void): Promise<void>;
  close(): Promise<void>;
}

/**
 * SQLite storage implementation for mobile platforms
 */
export class SQLiteStorage implements IStorageAbstraction {
  private db: SQLiteDatabase | null = null;
  private encryptionHook: EncryptionHook | null = null;
  private config: SQLiteConfig = {
    databasePath: 'webwaka_offline.db',
    debug: false,
    enableWAL: true
  };
  private initialized = false;
  
  /**
   * Initialize SQLite storage
   */
  async initialize(config?: Record<string, any>): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    try {
      // In production, open SQLite database
      // this.db = await SQLite.openDatabase(this.config.databasePath!);
      
      // For now, create mock database
      this.db = this.createMockDatabase();
      
      // Enable WAL mode for better concurrency
      if (this.config.enableWAL) {
        await this.executeSql('PRAGMA journal_mode=WAL');
      }
      
      // Create master table for tracking collections
      await this.executeSql(`
        CREATE TABLE IF NOT EXISTS _collections (
          name TEXT PRIMARY KEY,
          created_at TEXT NOT NULL
        )
      `);
      
      this.initialized = true;
      this.log('SQLite storage initialized');
    } catch (error) {
      throw new StorageError(
        'Failed to initialize SQLite storage',
        StorageErrorCode.INITIALIZATION_FAILED,
        error
      );
    }
  }
  
  /**
   * Create mock database (for development/testing)
   */
  private createMockDatabase(): SQLiteDatabase {
    const tables: Map<string, any[]> = new Map();
    
    return {
      executeSql: async (sql: string, params?: any[]) => {
        this.log(`SQL: ${sql} | Params: ${JSON.stringify(params)}`);
        
        // Mock implementation
        return {
          rows: { _array: [], length: 0 },
          rowsAffected: 0,
          insertId: undefined
        };
      },
      transaction: async (callback: (tx: any) => void) => {
        callback({
          executeSql: this.executeSql.bind(this)
        });
      },
      close: async () => {
        this.log('Database closed');
      }
    };
  }
  
  /**
   * Ensure table exists for collection
   */
  private async ensureTable(collection: string): Promise<void> {
    this.ensureInitialized();
    
    // Check if collection exists
    const result = await this.executeSql(
      'SELECT name FROM _collections WHERE name = ?',
      [collection]
    );
    
    if (result.rows.length === 0) {
      // Create table for collection
      await this.executeSql(`
        CREATE TABLE IF NOT EXISTS "${collection}" (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL,
          hash TEXT NOT NULL,
          synced INTEGER NOT NULL DEFAULT 0,
          last_synced_at TEXT
        )
      `);
      
      // Create indexes
      await this.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_${collection}_created_at 
        ON "${collection}"(created_at)
      `);
      
      await this.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_${collection}_updated_at 
        ON "${collection}"(updated_at)
      `);
      
      await this.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_${collection}_synced 
        ON "${collection}"(synced)
      `);
      
      // Register collection
      await this.executeSql(
        'INSERT INTO _collections (name, created_at) VALUES (?, ?)',
        [collection, new Date().toISOString()]
      );
      
      this.log(`Created table: ${collection}`);
    }
  }
  
  /**
   * Get entity by ID
   */
  async get<T = any>(collection: string, id: string): Promise<StorageEntity<T> | null> {
    this.ensureInitialized();
    await this.ensureTable(collection);
    
    try {
      const result = await this.executeSql(
        `SELECT * FROM "${collection}" WHERE id = ?`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      let data = JSON.parse(row.data);
      
      // Decrypt if encryption hook is set
      if (this.encryptionHook) {
        data = await this.encryptionHook.decrypt(data);
      }
      
      const entity: StorageEntity<T> = {
        data,
        metadata: {
          id: row.id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          version: row.version,
          hash: row.hash,
          synced: row.synced === 1,
          lastSyncedAt: row.last_synced_at
        }
      };
      
      return entity;
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
    await this.ensureTable(collection);
    
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
      let encryptedData: any = dataToStore;
      if (this.encryptionHook) {
        encryptedData = await this.encryptionHook.encrypt(dataToStore);
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
      
      // Insert or replace entity
      await this.executeSql(
        `INSERT OR REPLACE INTO "${collection}" 
         (id, data, created_at, updated_at, version, hash, synced, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          metadata.id,
          JSON.stringify(encryptedData),
          metadata.createdAt,
          metadata.updatedAt,
          metadata.version,
          metadata.hash,
          metadata.synced ? 1 : 0,
          metadata.lastSyncedAt
        ]
      );
      
      this.log(`Stored entity: ${collection}/${id}`);
      
      // Return entity with original unencrypted data
      return {
        data,
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
    await this.ensureTable(collection);
    
    try {
      // Build SQL query
      let sql = `SELECT * FROM "${collection}"`;
      const params: any[] = [];
      
      // Add WHERE clause for conditions
      if (options?.conditions && options.conditions.length > 0) {
        const whereClauses = options.conditions.map((condition) => {
          return this.buildWhereClause(condition, params);
        });
        sql += ' WHERE ' + whereClauses.join(' AND ');
      }
      
      // Add ORDER BY clause
      if (options?.sort && options.sort.length > 0) {
        const orderClauses = options.sort.map((sort) => {
          const direction = sort.direction === 'desc' ? 'DESC' : 'ASC';
          return `${sort.field} ${direction}`;
        });
        sql += ' ORDER BY ' + orderClauses.join(', ');
      }
      
      // Get total count
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
      const countResult = await this.executeSql(countSql, params);
      const totalCount = countResult.rows[0]?.count || 0;
      
      // Add LIMIT and OFFSET
      if (options?.limit) {
        sql += ` LIMIT ${options.limit}`;
      }
      if (options?.offset) {
        sql += ` OFFSET ${options.offset}`;
      }
      
      // Execute query
      const result = await this.executeSql(sql, params);
      
      // Parse entities
      const entities: StorageEntity<T>[] = [];
      for (const row of result.rows) {
        let data = JSON.parse(row.data);
        
        // Decrypt if encryption hook is set
        if (this.encryptionHook) {
          data = await this.encryptionHook.decrypt(data);
        }
        
        entities.push({
          data,
          metadata: {
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            version: row.version,
            hash: row.hash,
            synced: row.synced === 1,
            lastSyncedAt: row.last_synced_at
          }
        });
      }
      
      const offset = options?.offset || 0;
      const limit = options?.limit || totalCount;
      
      return {
        entities,
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
    await this.ensureTable(collection);
    
    try {
      const result = await this.executeSql(
        `DELETE FROM "${collection}" WHERE id = ?`,
        [id]
      );
      
      const deleted = result.rowsAffected > 0;
      
      if (deleted) {
        this.log(`Deleted entity: ${collection}/${id}`);
      }
      
      return { deleted, id };
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
    await this.ensureTable(collection);
    
    try {
      // Get count before clearing
      const countResult = await this.executeSql(
        `SELECT COUNT(*) as count FROM "${collection}"`
      );
      const count = countResult.rows[0]?.count || 0;
      
      // Clear collection
      await this.executeSql(`DELETE FROM "${collection}"`);
      
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
      // Get all collections
      const result = await this.executeSql('SELECT name FROM _collections');
      const collections = result.rows.map((row: any) => row.name);
      
      let totalCount = 0;
      
      // Clear each collection
      for (const collection of collections) {
        const count = await this.clear(collection);
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
      // Get all collections
      const collectionsResult = await this.executeSql('SELECT name FROM _collections');
      const collections = collectionsResult.rows.map((row: any) => row.name);
      
      let entityCount = 0;
      let unsyncedCount = 0;
      
      for (const collection of collections) {
        const countResult = await this.executeSql(
          `SELECT COUNT(*) as count FROM "${collection}"`
        );
        entityCount += countResult.rows[0]?.count || 0;
        
        const unsyncedResult = await this.executeSql(
          `SELECT COUNT(*) as count FROM "${collection}" WHERE synced = 0`
        );
        unsyncedCount += unsyncedResult.rows[0]?.count || 0;
      }
      
      // Get database file size (platform-specific)
      // In production, use FileSystem API to get actual file size
      const sizeBytes = 0; // Placeholder
      
      return {
        entityCount,
        sizeBytes,
        unsyncedCount,
        backend: 'SQLite',
        quotaBytes: null, // SQLite doesn't have built-in quota
        availableBytes: null
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
      await this.db.close();
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
  
  private async executeSql(sql: string, params?: any[]): Promise<any> {
    if (!this.db) {
      throw new StorageError(
        'Database not initialized',
        StorageErrorCode.NOT_INITIALIZED
      );
    }
    
    return new Promise((resolve, reject) => {
      this.db!.executeSql(
        sql,
        params,
        (tx, results) => resolve(results),
        (tx, error) => reject(error)
      );
    });
  }
  
  private calculateHash(data: any): string {
    const json = JSON.stringify(data);
    return createHash('sha256').update(json).digest('hex');
  }
  
  private buildWhereClause(condition: QueryCondition, params: any[]): string {
    const field = condition.field.replace('metadata.', '');
    
    switch (condition.operator) {
      case 'eq':
        params.push(condition.value);
        return `${field} = ?`;
      case 'ne':
        params.push(condition.value);
        return `${field} != ?`;
      case 'gt':
        params.push(condition.value);
        return `${field} > ?`;
      case 'gte':
        params.push(condition.value);
        return `${field} >= ?`;
      case 'lt':
        params.push(condition.value);
        return `${field} < ?`;
      case 'lte':
        params.push(condition.value);
        return `${field} <= ?`;
      case 'in':
        const placeholders = condition.value.map(() => '?').join(', ');
        params.push(...condition.value);
        return `${field} IN (${placeholders})`;
      case 'contains':
        params.push(`%${condition.value}%`);
        return `${field} LIKE ?`;
      case 'startsWith':
        params.push(`${condition.value}%`);
        return `${field} LIKE ?`;
      case 'endsWith':
        params.push(`%${condition.value}`);
        return `${field} LIKE ?`;
      default:
        throw new StorageError(
          `Unsupported operator: ${condition.operator}`,
          StorageErrorCode.INVALID_QUERY
        );
    }
  }
  
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[SQLiteStorage] ${message}`);
    }
  }
}
