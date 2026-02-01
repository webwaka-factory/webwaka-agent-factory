/**
 * TXQ-001 — Persistent Transaction Queue Implementation
 * 
 * Implements a durable FIFO transaction queue using OFF-001 storage abstraction.
 * Maintains deterministic ordering and survives app restarts.
 * 
 * @module PersistentTransactionQueue
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import {
  ITransactionQueue,
  Transaction,
  TransactionPayload,
  TransactionOptions,
  TransactionMetadata,
  TransactionStatus,
  TransactionType,
  TransactionPriority,
  TransactionQueryOptions,
  TransactionQueryResult,
  QueueStats,
  QueueConfig,
  QueueError,
  QueueErrorCode
} from '../interfaces/TransactionQueue';
import { IStorageAbstraction } from '../../storage/interfaces/StorageAbstraction';
// Simple UUID v4 generator (no external dependencies)
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Persistent transaction queue implementation
 */
export class PersistentTransactionQueue implements ITransactionQueue {
  private storage: IStorageAbstraction;
  private config: QueueConfig | null = null;
  private initialized: boolean = false;
  private readonly COLLECTION_NAME = 'transaction_queue';
  
  constructor(storage: IStorageAbstraction) {
    this.storage = storage;
  }
  
  /**
   * Initialize the queue
   */
  async initialize(config: QueueConfig): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      this.config = config;
      
      // Ensure storage is initialized
      if (!this.storage) {
        throw new QueueError(
          'Storage abstraction not provided',
          QueueErrorCode.INITIALIZATION_FAILED
        );
      }
      
      this.initialized = true;
      this.log('Transaction queue initialized');
    } catch (error) {
      throw new QueueError(
        'Failed to initialize transaction queue',
        QueueErrorCode.INITIALIZATION_FAILED,
        error
      );
    }
  }
  
  /**
   * Enqueue a new transaction
   */
  async enqueue(payload: TransactionPayload, options?: TransactionOptions): Promise<Transaction> {
    this.ensureInitialized();
    
    try {
      // Check queue capacity
      const stats = await this.getStats();
      if (stats.totalCount >= this.config!.maxTransactions) {
        throw new QueueError(
          `Queue is full (${this.config!.maxTransactions} transactions)`,
          QueueErrorCode.QUEUE_FULL
        );
      }
      
      // Create transaction metadata
      const now = new Date().toISOString();
      const transactionId = generateId();
      
      const metadata: TransactionMetadata = {
        id: transactionId,
        type: this.inferTransactionType(payload.action),
        status: TransactionStatus.PENDING,
        priority: options?.priority || TransactionPriority.NORMAL,
        createdAt: now,
        queuedAt: now,
        syncStartedAt: null,
        syncCompletedAt: null,
        attempts: 0,
        maxAttempts: options?.maxAttempts || this.config!.defaultMaxAttempts,
        lastError: null,
        serverTransactionId: null,
        relatedTransactionIds: options?.relatedTransactionIds || [],
        userId: this.config!.userId,
        deviceId: this.config!.deviceId,
        customMetadata: options?.customMetadata
      };
      
      const transaction: Transaction = {
        metadata,
        payload
      };
      
      // Store transaction
      await this.storage.set(this.COLLECTION_NAME, transactionId, transaction);
      
      this.log(`Transaction enqueued: ${transactionId}`);
      
      return transaction;
    } catch (error) {
      if (error instanceof QueueError) {
        throw error;
      }
      throw new QueueError(
        'Failed to enqueue transaction',
        QueueErrorCode.ENQUEUE_FAILED,
        error
      );
    }
  }
  
  /**
   * Dequeue the next pending transaction (FIFO by timestamp)
   */
  async dequeue(): Promise<Transaction | null> {
    this.ensureInitialized();
    
    try {
      // Query for pending transactions, sorted by queuedAt (FIFO)
      const result = await this.storage.query<Transaction>(this.COLLECTION_NAME, {
        conditions: [
          { field: 'data.metadata.status', operator: 'eq', value: TransactionStatus.PENDING }
        ],
        sort: [
          { field: 'data.metadata.queuedAt', direction: 'asc' }
        ],
        limit: 1
      });
      
      if (result.entities.length === 0) {
        return null;
      }
      
      const transaction = result.entities[0].data;
      
      // Update status to syncing
      await this.updateStatus(transaction.metadata.id, TransactionStatus.SYNCING);
      
      // Fetch updated transaction
      const updated = await this.storage.get<Transaction>(
        this.COLLECTION_NAME,
        transaction.metadata.id
      );
      
      this.log(`Transaction dequeued: ${transaction.metadata.id}`);
      
      return updated?.data || null;
    } catch (error) {
      throw new QueueError(
        'Failed to dequeue transaction',
        QueueErrorCode.DEQUEUE_FAILED,
        error
      );
    }
  }
  
  /**
   * Peek at the next pending transaction without removing it
   */
  async peek(): Promise<Transaction | null> {
    this.ensureInitialized();
    
    try {
      const result = await this.storage.query<Transaction>(this.COLLECTION_NAME, {
        conditions: [
          { field: 'data.metadata.status', operator: 'eq', value: TransactionStatus.PENDING }
        ],
        sort: [
          { field: 'data.metadata.queuedAt', direction: 'asc' }
        ],
        limit: 1
      });
      
      return result.entities.length > 0 ? result.entities[0].data : null;
    } catch (error) {
      throw new QueueError(
        'Failed to peek transaction',
        QueueErrorCode.QUERY_FAILED,
        error
      );
    }
  }
  
  /**
   * Get transaction by ID
   */
  async get(transactionId: string): Promise<Transaction | null> {
    this.ensureInitialized();
    
    try {
      const entity = await this.storage.get<Transaction>(this.COLLECTION_NAME, transactionId);
      return entity?.data || null;
    } catch (error) {
      throw new QueueError(
        `Failed to get transaction: ${transactionId}`,
        QueueErrorCode.QUERY_FAILED,
        error
      );
    }
  }
  
  /**
   * Update transaction status
   */
  async updateStatus(
    transactionId: string,
    status: TransactionStatus,
    error?: string,
    serverTransactionId?: string
  ): Promise<void> {
    this.ensureInitialized();
    
    try {
      const transaction = await this.get(transactionId);
      
      if (!transaction) {
        throw new QueueError(
          `Transaction not found: ${transactionId}`,
          QueueErrorCode.TRANSACTION_NOT_FOUND
        );
      }
      
      // Validate status transition
      this.validateStatusTransition(transaction.metadata.status, status);
      
      // Update metadata
      const now = new Date().toISOString();
      transaction.metadata.status = status;
      
      if (status === TransactionStatus.SYNCING) {
        transaction.metadata.syncStartedAt = now;
        transaction.metadata.attempts++;
      } else if (status === TransactionStatus.SYNCED) {
        transaction.metadata.syncCompletedAt = now;
        transaction.metadata.serverTransactionId = serverTransactionId || null;
      } else if (status === TransactionStatus.FAILED) {
        transaction.metadata.lastError = error || 'Unknown error';
      }
      
      // Save updated transaction
      await this.storage.set(this.COLLECTION_NAME, transactionId, transaction);
      
      this.log(`Transaction status updated: ${transactionId} -> ${status}`);
    } catch (error) {
      if (error instanceof QueueError) {
        throw error;
      }
      throw new QueueError(
        `Failed to update transaction status: ${transactionId}`,
        QueueErrorCode.UPDATE_FAILED,
        error
      );
    }
  }
  
  /**
   * Query transactions
   */
  async query(options?: TransactionQueryOptions): Promise<TransactionQueryResult> {
    this.ensureInitialized();
    
    try {
      const conditions: any[] = [];
      
      // Build query conditions
      if (options?.status) {
        const statuses = Array.isArray(options.status) ? options.status : [options.status];
        if (statuses.length === 1) {
          conditions.push({
            field: 'data.metadata.status',
            operator: 'eq',
            value: statuses[0]
          });
        } else {
          conditions.push({
            field: 'data.metadata.status',
            operator: 'in',
            value: statuses
          });
        }
      }
      
      if (options?.type) {
        const types = Array.isArray(options.type) ? options.type : [options.type];
        if (types.length === 1) {
          conditions.push({
            field: 'data.metadata.type',
            operator: 'eq',
            value: types[0]
          });
        } else {
          conditions.push({
            field: 'data.metadata.type',
            operator: 'in',
            value: types
          });
        }
      }
      
      if (options?.priority !== undefined) {
        const priorities = Array.isArray(options.priority) ? options.priority : [options.priority];
        if (priorities.length === 1) {
          conditions.push({
            field: 'data.metadata.priority',
            operator: 'eq',
            value: priorities[0]
          });
        } else {
          conditions.push({
            field: 'data.metadata.priority',
            operator: 'in',
            value: priorities
          });
        }
      }
      
      if (options?.userId) {
        conditions.push({
          field: 'data.metadata.userId',
          operator: 'eq',
          value: options.userId
        });
      }
      
      if (options?.deviceId) {
        conditions.push({
          field: 'data.metadata.deviceId',
          operator: 'eq',
          value: options.deviceId
        });
      }
      
      if (options?.resource) {
        conditions.push({
          field: 'data.payload.resource',
          operator: 'eq',
          value: options.resource
        });
      }
      
      // Query storage
      const result = await this.storage.query<Transaction>(this.COLLECTION_NAME, {
        conditions: conditions.length > 0 ? conditions : undefined,
        sort: [
          { field: 'data.metadata.queuedAt', direction: options?.sortOrder || 'asc' }
        ],
        limit: options?.limit,
        offset: options?.offset
      });
      
      return {
        transactions: result.entities.map(e => e.data),
        totalCount: result.totalCount,
        hasMore: result.hasMore
      };
    } catch (error) {
      throw new QueueError(
        'Failed to query transactions',
        QueueErrorCode.QUERY_FAILED,
        error
      );
    }
  }
  
  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    this.ensureInitialized();
    
    try {
      // Get all transactions
      const allResult = await this.storage.query<Transaction>(this.COLLECTION_NAME);
      const allTransactions = allResult.entities.map(e => e.data);
      
      // Count by status
      const pendingCount = allTransactions.filter(t => t.metadata.status === TransactionStatus.PENDING).length;
      const syncingCount = allTransactions.filter(t => t.metadata.status === TransactionStatus.SYNCING).length;
      const syncedCount = allTransactions.filter(t => t.metadata.status === TransactionStatus.SYNCED).length;
      const failedCount = allTransactions.filter(t => t.metadata.status === TransactionStatus.FAILED).length;
      
      // Find oldest and newest pending
      const pendingTransactions = allTransactions.filter(t => t.metadata.status === TransactionStatus.PENDING);
      const oldestPending = pendingTransactions.length > 0
        ? pendingTransactions.reduce((oldest, t) => 
            t.metadata.queuedAt! < oldest.metadata.queuedAt! ? t : oldest
          )
        : null;
      const newestPending = pendingTransactions.length > 0
        ? pendingTransactions.reduce((newest, t) => 
            t.metadata.queuedAt! > newest.metadata.queuedAt! ? t : newest
          )
        : null;
      
      // Calculate average sync time
      const syncedTransactions = allTransactions.filter(
        t => t.metadata.status === TransactionStatus.SYNCED && 
             t.metadata.syncStartedAt && 
             t.metadata.syncCompletedAt
      );
      const avgSyncTime = syncedTransactions.length > 0
        ? syncedTransactions.reduce((sum, t) => {
            const start = new Date(t.metadata.syncStartedAt!).getTime();
            const end = new Date(t.metadata.syncCompletedAt!).getTime();
            return sum + (end - start);
          }, 0) / syncedTransactions.length
        : 0;
      
      return {
        totalCount: allTransactions.length,
        pendingCount,
        syncingCount,
        syncedCount,
        failedCount,
        oldestPendingTimestamp: oldestPending?.metadata.queuedAt || null,
        newestPendingTimestamp: newestPending?.metadata.queuedAt || null,
        avgSyncTime,
        capacity: this.config!.maxTransactions,
        availableCapacity: this.config!.maxTransactions - allTransactions.length
      };
    } catch (error) {
      throw new QueueError(
        'Failed to get queue statistics',
        QueueErrorCode.QUERY_FAILED,
        error
      );
    }
  }
  
  /**
   * Clear all synced transactions
   */
  async clearSynced(): Promise<number> {
    this.ensureInitialized();
    
    try {
      const result = await this.query({ status: TransactionStatus.SYNCED });
      
      for (const transaction of result.transactions) {
        await this.storage.delete(this.COLLECTION_NAME, transaction.metadata.id);
      }
      
      this.log(`Cleared ${result.totalCount} synced transactions`);
      
      return result.totalCount;
    } catch (error) {
      throw new QueueError(
        'Failed to clear synced transactions',
        QueueErrorCode.STORAGE_ERROR,
        error
      );
    }
  }
  
  /**
   * Clear all failed transactions
   */
  async clearFailed(): Promise<number> {
    this.ensureInitialized();
    
    try {
      const result = await this.query({ status: TransactionStatus.FAILED });
      
      for (const transaction of result.transactions) {
        await this.storage.delete(this.COLLECTION_NAME, transaction.metadata.id);
      }
      
      this.log(`Cleared ${result.totalCount} failed transactions`);
      
      return result.totalCount;
    } catch (error) {
      throw new QueueError(
        'Failed to clear failed transactions',
        QueueErrorCode.STORAGE_ERROR,
        error
      );
    }
  }
  
  /**
   * Clear all transactions
   */
  async clearAll(): Promise<number> {
    this.ensureInitialized();
    
    try {
      const count = await this.storage.clear(this.COLLECTION_NAME);
      
      this.log(`Cleared all ${count} transactions`);
      
      return count;
    } catch (error) {
      throw new QueueError(
        'Failed to clear all transactions',
        QueueErrorCode.STORAGE_ERROR,
        error
      );
    }
  }
  
  /**
   * Retry a failed transaction
   */
  async retry(transactionId: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      const transaction = await this.get(transactionId);
      
      if (!transaction) {
        throw new QueueError(
          `Transaction not found: ${transactionId}`,
          QueueErrorCode.TRANSACTION_NOT_FOUND
        );
      }
      
      if (transaction.metadata.status !== TransactionStatus.FAILED) {
        throw new QueueError(
          `Transaction is not in failed state: ${transactionId}`,
          QueueErrorCode.INVALID_STATUS_TRANSITION
        );
      }
      
      if (transaction.metadata.attempts >= transaction.metadata.maxAttempts) {
        throw new QueueError(
          `Transaction has exceeded max attempts: ${transactionId}`,
          QueueErrorCode.INVALID_STATUS_TRANSITION
        );
      }
      
      // Reset to pending
      transaction.metadata.status = TransactionStatus.PENDING;
      transaction.metadata.lastError = null;
      
      await this.storage.set(this.COLLECTION_NAME, transactionId, transaction);
      
      this.log(`Transaction retry queued: ${transactionId}`);
    } catch (error) {
      if (error instanceof QueueError) {
        throw error;
      }
      throw new QueueError(
        `Failed to retry transaction: ${transactionId}`,
        QueueErrorCode.UPDATE_FAILED,
        error
      );
    }
  }
  
  /**
   * Cancel a pending transaction
   */
  async cancel(transactionId: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      const transaction = await this.get(transactionId);
      
      if (!transaction) {
        throw new QueueError(
          `Transaction not found: ${transactionId}`,
          QueueErrorCode.TRANSACTION_NOT_FOUND
        );
      }
      
      if (transaction.metadata.status !== TransactionStatus.PENDING) {
        throw new QueueError(
          `Transaction is not in pending state: ${transactionId}`,
          QueueErrorCode.INVALID_STATUS_TRANSITION
        );
      }
      
      transaction.metadata.status = TransactionStatus.CANCELLED;
      
      await this.storage.set(this.COLLECTION_NAME, transactionId, transaction);
      
      this.log(`Transaction cancelled: ${transactionId}`);
    } catch (error) {
      if (error instanceof QueueError) {
        throw error;
      }
      throw new QueueError(
        `Failed to cancel transaction: ${transactionId}`,
        QueueErrorCode.UPDATE_FAILED,
        error
      );
    }
  }
  
  /**
   * Check if queue is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Close the queue
   */
  async close(): Promise<void> {
    this.initialized = false;
    this.config = null;
    this.log('Transaction queue closed');
  }
  
  // Private helper methods
  
  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new QueueError(
        'Transaction queue not initialized',
        QueueErrorCode.NOT_INITIALIZED
      );
    }
  }
  
  private inferTransactionType(action: string): TransactionType {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('create')) return TransactionType.CREATE;
    if (actionLower.includes('update')) return TransactionType.UPDATE;
    if (actionLower.includes('delete')) return TransactionType.DELETE;
    return TransactionType.CUSTOM;
  }
  
  private validateStatusTransition(from: TransactionStatus, to: TransactionStatus): void {
    const validTransitions: Record<TransactionStatus, TransactionStatus[]> = {
      [TransactionStatus.NEW]: [TransactionStatus.PENDING, TransactionStatus.CANCELLED],
      [TransactionStatus.PENDING]: [TransactionStatus.SYNCING, TransactionStatus.CANCELLED],
      [TransactionStatus.SYNCING]: [TransactionStatus.SYNCED, TransactionStatus.FAILED],
      [TransactionStatus.SYNCED]: [],
      [TransactionStatus.FAILED]: [TransactionStatus.PENDING],
      [TransactionStatus.CANCELLED]: []
    };
    
    if (!validTransitions[from].includes(to)) {
      throw new QueueError(
        `Invalid status transition: ${from} -> ${to}`,
        QueueErrorCode.INVALID_STATUS_TRANSITION
      );
    }
  }
  
  private log(message: string): void {
    if (this.config?.debug) {
      console.log(`[TransactionQueue] ${message}`);
    }
  }
}
