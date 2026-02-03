/**
 * TXQ-001 — Persistent Offline Transaction Queue
 * 
 * This module defines the transaction queue interface for offline-first operations.
 * Implements a durable FIFO queue that persists across app restarts.
 * 
 * @module TransactionQueue
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

/**
 * Transaction status lifecycle
 */
export enum TransactionStatus {
  /** Transaction created but not yet queued */
  NEW = 'new',
  
  /** Transaction queued and waiting for sync */
  PENDING = 'pending',
  
  /** Transaction currently being synced to server */
  SYNCING = 'syncing',
  
  /** Transaction successfully synced */
  SYNCED = 'synced',
  
  /** Transaction sync failed */
  FAILED = 'failed',
  
  /** Transaction cancelled by user */
  CANCELLED = 'cancelled'
}

/**
 * Transaction type
 */
export enum TransactionType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  CUSTOM = 'custom'
}

/**
 * Transaction priority
 */
export enum TransactionPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Transaction metadata
 */
export interface TransactionMetadata {
  /** Unique transaction ID */
  id: string;
  
  /** Transaction type */
  type: TransactionType;
  
  /** Transaction status */
  status: TransactionStatus;
  
  /** Transaction priority */
  priority: TransactionPriority;
  
  /** Timestamp when transaction was created (ISO 8601) */
  createdAt: string;
  
  /** Timestamp when transaction was queued (ISO 8601) */
  queuedAt: string | null;
  
  /** Timestamp when sync started (ISO 8601) */
  syncStartedAt: string | null;
  
  /** Timestamp when sync completed (ISO 8601) */
  syncCompletedAt: string | null;
  
  /** Number of sync attempts */
  attempts: number;
  
  /** Maximum retry attempts allowed */
  maxAttempts: number;
  
  /** Last error message (if failed) */
  lastError: string | null;
  
  /** Server transaction ID (if synced) */
  serverTransactionId: string | null;
  
  /** Related transaction IDs (for grouping) */
  relatedTransactionIds: string[];
  
  /** User ID who initiated the transaction */
  userId: string;
  
  /** Device ID where transaction was created */
  deviceId: string;
  
  /** Custom metadata */
  customMetadata?: Record<string, any>;
}

/**
 * Transaction payload
 */
export interface TransactionPayload {
  /** Resource type (e.g., 'users', 'posts', 'comments') */
  resource: string;
  
  /** Resource ID (if applicable) */
  resourceId?: string;
  
  /** Action to perform (e.g., 'create', 'update', 'delete') */
  action: string;
  
  /** Data payload */
  data: any;
  
  /** Optional query parameters */
  params?: Record<string, any>;
}

/**
 * Complete transaction
 */
export interface Transaction {
  /** Transaction metadata */
  metadata: TransactionMetadata;
  
  /** Transaction payload */
  payload: TransactionPayload;
}

/**
 * Transaction creation options
 */
export interface TransactionOptions {
  /** Transaction priority */
  priority?: TransactionPriority;
  
  /** Maximum retry attempts */
  maxAttempts?: number;
  
  /** Related transaction IDs */
  relatedTransactionIds?: string[];
  
  /** Custom metadata */
  customMetadata?: Record<string, any>;
}

/**
 * Transaction query options
 */
export interface TransactionQueryOptions {
  /** Filter by status */
  status?: TransactionStatus | TransactionStatus[];
  
  /** Filter by type */
  type?: TransactionType | TransactionType[];
  
  /** Filter by priority */
  priority?: TransactionPriority | TransactionPriority[];
  
  /** Filter by user ID */
  userId?: string;
  
  /** Filter by device ID */
  deviceId?: string;
  
  /** Filter by resource */
  resource?: string;
  
  /** Limit number of results */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
  
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Transaction query result
 */
export interface TransactionQueryResult {
  /** Matching transactions */
  transactions: Transaction[];
  
  /** Total count (before pagination) */
  totalCount: number;
  
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Total transactions in queue */
  totalCount: number;
  
  /** Pending transactions */
  pendingCount: number;
  
  /** Syncing transactions */
  syncingCount: number;
  
  /** Synced transactions */
  syncedCount: number;
  
  /** Failed transactions */
  failedCount: number;
  
  /** Oldest pending transaction timestamp */
  oldestPendingTimestamp: string | null;
  
  /** Newest pending transaction timestamp */
  newestPendingTimestamp: string | null;
  
  /** Average sync time in milliseconds */
  avgSyncTime: number;
  
  /** Queue capacity (max transactions) */
  capacity: number;
  
  /** Available capacity */
  availableCapacity: number;
}

/**
 * Transaction queue configuration
 */
export interface QueueConfig {
  /** Maximum number of transactions in queue */
  maxTransactions: number;
  
  /** Maximum retry attempts per transaction */
  defaultMaxAttempts: number;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** User ID for tracking */
  userId: string;
  
  /** Device ID for tracking */
  deviceId: string;
}

/**
 * Core transaction queue interface
 */
export interface ITransactionQueue {
  /**
   * Initialize the transaction queue
   * 
   * @param config - Queue configuration
   * @throws {QueueError} If initialization fails
   */
  initialize(config: QueueConfig): Promise<void>;
  
  /**
   * Enqueue a new transaction
   * 
   * @param payload - Transaction payload
   * @param options - Transaction options
   * @returns Created transaction
   * @throws {QueueError} If queue is full or enqueue fails
   */
  enqueue(payload: TransactionPayload, options?: TransactionOptions): Promise<Transaction>;
  
  /**
   * Dequeue the next pending transaction (FIFO)
   * 
   * @returns Next transaction or null if queue is empty
   * @throws {QueueError} If dequeue fails
   */
  dequeue(): Promise<Transaction | null>;
  
  /**
   * Peek at the next pending transaction without removing it
   * 
   * @returns Next transaction or null if queue is empty
   * @throws {QueueError} If peek fails
   */
  peek(): Promise<Transaction | null>;
  
  /**
   * Get transaction by ID
   * 
   * @param transactionId - Transaction ID
   * @returns Transaction or null if not found
   * @throws {QueueError} If get fails
   */
  get(transactionId: string): Promise<Transaction | null>;
  
  /**
   * Update transaction status
   * 
   * @param transactionId - Transaction ID
   * @param status - New status
   * @param error - Error message (if failed)
   * @param serverTransactionId - Server transaction ID (if synced)
   * @throws {QueueError} If update fails
   */
  updateStatus(
    transactionId: string,
    status: TransactionStatus,
    error?: string,
    serverTransactionId?: string
  ): Promise<void>;
  
  /**
   * Query transactions
   * 
   * @param options - Query options
   * @returns Query result
   * @throws {QueueError} If query fails
   */
  query(options?: TransactionQueryOptions): Promise<TransactionQueryResult>;
  
  /**
   * Get queue statistics
   * 
   * @returns Queue statistics
   * @throws {QueueError} If stats retrieval fails
   */
  getStats(): Promise<QueueStats>;
  
  /**
   * Clear all synced transactions
   * 
   * @returns Number of transactions cleared
   * @throws {QueueError} If clear fails
   */
  clearSynced(): Promise<number>;
  
  /**
   * Clear all failed transactions
   * 
   * @returns Number of transactions cleared
   * @throws {QueueError} If clear fails
   */
  clearFailed(): Promise<number>;
  
  /**
   * Clear all transactions (dangerous!)
   * 
   * @returns Number of transactions cleared
   * @throws {QueueError} If clear fails
   */
  clearAll(): Promise<number>;
  
  /**
   * Retry a failed transaction
   * 
   * @param transactionId - Transaction ID
   * @throws {QueueError} If retry fails
   */
  retry(transactionId: string): Promise<void>;
  
  /**
   * Cancel a pending transaction
   * 
   * @param transactionId - Transaction ID
   * @throws {QueueError} If cancel fails
   */
  cancel(transactionId: string): Promise<void>;
  
  /**
   * Check if queue is initialized
   * 
   * @returns True if initialized
   */
  isInitialized(): boolean;
  
  /**
   * Close the queue and release resources
   * 
   * @throws {QueueError} If close fails
   */
  close(): Promise<void>;
}

/**
 * Custom error class for queue operations
 */
export class QueueError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'QueueError';
  }
}

/**
 * Queue error codes
 */
export enum QueueErrorCode {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  QUEUE_FULL = 'QUEUE_FULL',
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
  ENQUEUE_FAILED = 'ENQUEUE_FAILED',
  DEQUEUE_FAILED = 'DEQUEUE_FAILED',
  UPDATE_FAILED = 'UPDATE_FAILED',
  QUERY_FAILED = 'QUERY_FAILED',
  STORAGE_ERROR = 'STORAGE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Transaction event types
 */
export enum TransactionEventType {
  ENQUEUED = 'enqueued',
  DEQUEUED = 'dequeued',
  STATUS_CHANGED = 'status_changed',
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
  RETRY = 'retry',
  CANCELLED = 'cancelled'
}

/**
 * Transaction event
 */
export interface TransactionEvent {
  /** Event type */
  type: TransactionEventType;
  
  /** Transaction ID */
  transactionId: string;
  
  /** Timestamp (ISO 8601) */
  timestamp: string;
  
  /** Event data */
  data?: any;
}

/**
 * Transaction event listener
 */
export type TransactionEventListener = (event: TransactionEvent) => void;

/**
 * Extended queue interface with event support
 */
export interface ITransactionQueueWithEvents extends ITransactionQueue {
  /**
   * Add event listener
   * 
   * @param eventType - Event type to listen for
   * @param listener - Event listener function
   */
  on(eventType: TransactionEventType, listener: TransactionEventListener): void;
  
  /**
   * Remove event listener
   * 
   * @param eventType - Event type
   * @param listener - Event listener function
   */
  off(eventType: TransactionEventType, listener: TransactionEventListener): void;
  
  /**
   * Emit event
   * 
   * @param event - Transaction event
   */
  emit(event: TransactionEvent): void;
}
