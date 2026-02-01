/**
 * SYNC-002 — Automatic Sync Engine
 * 
 * Core sync engine that automatically syncs queued transactions when reconnected.
 * 
 * @module SyncEngine
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import { Transaction } from '../../transaction-queue/interfaces/TransactionQueue';

/**
 * Sync status
 */
export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  PAUSED = 'paused',
  ERROR = 'error'
}

/**
 * Sync result for a single transaction
 */
export interface SyncResult {
  transactionId: string;
  success: boolean;
  serverTransactionId?: string;
  error?: string;
  conflictData?: any;
}

/**
 * Batch sync result
 */
export interface BatchSyncResult {
  batchId: string;
  synced: SyncResult[];
  failed: SyncResult[];
  conflicts: SyncResult[];
  totalCount: number;
  successCount: number;
  failureCount: number;
  conflictCount: number;
  startTime: string;
  endTime: string;
  duration: number;
}

/**
 * Sync progress
 */
export interface SyncProgress {
  currentBatch: number;
  totalBatches: number;
  currentTransaction: number;
  totalTransactions: number;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  percentComplete: number;
  estimatedTimeRemaining: number | null;
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  syncEndpoint: string;
  batchSize?: number;
  syncTimeout?: number;
  enableDeltaSync?: boolean;
  autoSyncOnReconnect?: boolean;
  retryFailedTransactions?: boolean;
  maxConcurrentBatches?: number;
  debug?: boolean;
}

/**
 * Sync statistics
 */
export interface SyncStats {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  totalTransactionsSynced: number;
  totalTransactionsFailed: number;
  totalConflicts: number;
  avgSyncDuration: number;
  lastSyncTime: string | null;
  lastSyncSuccess: boolean;
}

/**
 * Sync event type
 */
export enum SyncEventType {
  SYNC_STARTED = 'sync_started',
  SYNC_PROGRESS = 'sync_progress',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
  SYNC_PAUSED = 'sync_paused',
  SYNC_RESUMED = 'sync_resumed',
  BATCH_STARTED = 'batch_started',
  BATCH_COMPLETED = 'batch_completed',
  BATCH_FAILED = 'batch_failed'
}

/**
 * Sync event
 */
export interface SyncEvent {
  type: SyncEventType;
  timestamp: string;
  data?: any;
}

/**
 * Sync event listener
 */
export type SyncEventListener = (event: SyncEvent) => void;

/**
 * Core sync engine interface
 */
export interface ISyncEngine {
  /**
   * Initialize sync engine
   */
  initialize(config: SyncConfig): Promise<void>;
  
  /**
   * Start automatic syncing
   */
  start(): Promise<void>;
  
  /**
   * Stop automatic syncing
   */
  stop(): Promise<void>;
  
  /**
   * Manually trigger a sync
   */
  sync(): Promise<BatchSyncResult[]>;
  
  /**
   * Pause ongoing sync
   */
  pause(): Promise<void>;
  
  /**
   * Resume paused sync
   */
  resume(): Promise<void>;
  
  /**
   * Get current sync status
   */
  getStatus(): SyncStatus;
  
  /**
   * Get sync progress
   */
  getProgress(): SyncProgress | null;
  
  /**
   * Get sync statistics
   */
  getStats(): SyncStats;
  
  /**
   * Add event listener
   */
  on(eventType: SyncEventType, listener: SyncEventListener): void;
  
  /**
   * Remove event listener
   */
  off(eventType: SyncEventType, listener: SyncEventListener): void;
  
  /**
   * Check if initialized
   */
  isInitialized(): boolean;
  
  /**
   * Check if syncing
   */
  isSyncing(): boolean;
  
  /**
   * Close sync engine
   */
  close(): Promise<void>;
}

/**
 * Sync engine error
 */
export class SyncEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'SyncEngineError';
  }
}

export enum SyncEngineErrorCode {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  SYNC_FAILED = 'SYNC_FAILED',
  BATCH_FAILED = 'BATCH_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
