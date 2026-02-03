/**
 * SYNC-002 — Automatic Sync Engine Implementation
 * 
 * Automatically syncs queued transactions when reconnected.
 * Implements batch processing, delta sync, and progress tracking.
 * 
 * @module AutomaticSyncEngine
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import {
  ISyncEngine,
  SyncStatus,
  SyncResult,
  BatchSyncResult,
  SyncProgress,
  SyncConfig,
  SyncStats,
  SyncEvent,
  SyncEventType,
  SyncEventListener,
  SyncEngineError,
  SyncEngineErrorCode
} from '../interfaces/SyncEngine';
import { ITransactionQueue, TransactionStatus } from '../../transaction-queue/interfaces/TransactionQueue';
import { INetworkDetection, NetworkEventType } from '../../network-detection/interfaces/NetworkDetection';

export class AutomaticSyncEngine implements ISyncEngine {
  private config: SyncConfig | null = null;
  private initialized: boolean = false;
  private status: SyncStatus = SyncStatus.IDLE;
  private progress: SyncProgress | null = null;
  
  private queue: ITransactionQueue;
  private networkDetection: INetworkDetection;
  
  private listeners: Map<SyncEventType, Set<SyncEventListener>> = new Map();
  private syncInProgress: boolean = false;
  private pauseRequested: boolean = false;
  
  private stats = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    totalTransactionsSynced: 0,
    totalTransactionsFailed: 0,
    totalConflicts: 0,
    syncDurations: [] as number[],
    lastSyncTime: null as string | null,
    lastSyncSuccess: false
  };
  
  constructor(queue: ITransactionQueue, networkDetection: INetworkDetection) {
    this.queue = queue;
    this.networkDetection = networkDetection;
  }
  
  async initialize(config: SyncConfig): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.config = {
        ...config,
        batchSize: config.batchSize || 50,
        syncTimeout: config.syncTimeout || 30000,
        enableDeltaSync: config.enableDeltaSync !== false,
        autoSyncOnReconnect: config.autoSyncOnReconnect !== false,
        retryFailedTransactions: config.retryFailedTransactions !== false,
        maxConcurrentBatches: config.maxConcurrentBatches || 1,
        debug: config.debug || false
      };
      
      // Initialize event listeners
      Object.values(SyncEventType).forEach(type => {
        this.listeners.set(type, new Set());
      });
      
      this.initialized = true;
      this.log('Sync engine initialized');
    } catch (error) {
      throw new SyncEngineError(
        'Failed to initialize sync engine',
        SyncEngineErrorCode.INITIALIZATION_FAILED,
        error
      );
    }
  }
  
  async start(): Promise<void> {
    this.ensureInitialized();
    
    if (this.config!.autoSyncOnReconnect) {
      // Subscribe to network reconnect events
      this.networkDetection.on(NetworkEventType.ONLINE, async () => {
        this.log('Network reconnected, triggering sync');
        await this.sync();
      });
    }
    
    this.log('Sync engine started');
  }
  
  async stop(): Promise<void> {
    this.pauseRequested = true;
    this.log('Sync engine stopped');
  }
  
  async sync(): Promise<BatchSyncResult[]> {
    this.ensureInitialized();
    
    if (this.syncInProgress) {
      this.log('Sync already in progress');
      return [];
    }
    
    this.syncInProgress = true;
    this.status = SyncStatus.SYNCING;
    this.pauseRequested = false;
    
    const syncStartTime = Date.now();
    const results: BatchSyncResult[] = [];
    
    try {
      this.emitEvent({
        type: SyncEventType.SYNC_STARTED,
        timestamp: new Date().toISOString()
      });
      
      // Get pending transactions
      const pendingResult = await this.queue.query({
        status: TransactionStatus.PENDING
      });
      
      const totalTransactions = pendingResult.totalCount;
      
      if (totalTransactions === 0) {
        this.log('No transactions to sync');
        this.status = SyncStatus.IDLE;
        this.syncInProgress = false;
        return [];
      }
      
      // Calculate batches
      const batchSize = this.config!.batchSize!;
      const totalBatches = Math.ceil(totalTransactions / batchSize);
      
      this.log(`Starting sync: ${totalTransactions} transactions in ${totalBatches} batches`);
      
      // Process batches
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        if (this.pauseRequested) {
          this.status = SyncStatus.PAUSED;
          break;
        }
        
        // Update progress
        this.updateProgress(batchNum, totalBatches, totalTransactions);
        
        // Sync batch
        const batchResult = await this.syncBatch(batchNum + 1);
        results.push(batchResult);
        
        // Update stats
        this.stats.totalTransactionsSynced += batchResult.successCount;
        this.stats.totalTransactionsFailed += batchResult.failureCount;
        this.stats.totalConflicts += batchResult.conflictCount;
      }
      
      // Update final stats
      const syncDuration = Date.now() - syncStartTime;
      this.stats.totalSyncs++;
      this.stats.successfulSyncs++;
      this.stats.syncDurations.push(syncDuration);
      this.stats.lastSyncTime = new Date().toISOString();
      this.stats.lastSyncSuccess = true;
      
      this.emitEvent({
        type: SyncEventType.SYNC_COMPLETED,
        timestamp: new Date().toISOString(),
        data: { results, duration: syncDuration }
      });
      
      this.log(`Sync completed: ${results.length} batches in ${syncDuration}ms`);
      
    } catch (error) {
      this.stats.failedSyncs++;
      this.stats.lastSyncSuccess = false;
      this.status = SyncStatus.ERROR;
      
      this.emitEvent({
        type: SyncEventType.SYNC_FAILED,
        timestamp: new Date().toISOString(),
        data: { error }
      });
      
      throw new SyncEngineError(
        'Sync failed',
        SyncEngineErrorCode.SYNC_FAILED,
        error
      );
    } finally {
      this.syncInProgress = false;
      this.progress = null;
      if (this.status !== SyncStatus.PAUSED) {
        this.status = SyncStatus.IDLE;
      }
    }
    
    return results;
  }
  
  async pause(): Promise<void> {
    this.pauseRequested = true;
    this.status = SyncStatus.PAUSED;
    this.emitEvent({
      type: SyncEventType.SYNC_PAUSED,
      timestamp: new Date().toISOString()
    });
  }
  
  async resume(): Promise<void> {
    if (this.status === SyncStatus.PAUSED) {
      this.pauseRequested = false;
      this.status = SyncStatus.IDLE;
      this.emitEvent({
        type: SyncEventType.SYNC_RESUMED,
        timestamp: new Date().toISOString()
      });
      await this.sync();
    }
  }
  
  getStatus(): SyncStatus {
    return this.status;
  }
  
  getProgress(): SyncProgress | null {
    return this.progress;
  }
  
  getStats(): SyncStats {
    const avgSyncDuration = this.stats.syncDurations.length > 0
      ? this.stats.syncDurations.reduce((sum, d) => sum + d, 0) / this.stats.syncDurations.length
      : 0;
    
    return {
      totalSyncs: this.stats.totalSyncs,
      successfulSyncs: this.stats.successfulSyncs,
      failedSyncs: this.stats.failedSyncs,
      totalTransactionsSynced: this.stats.totalTransactionsSynced,
      totalTransactionsFailed: this.stats.totalTransactionsFailed,
      totalConflicts: this.stats.totalConflicts,
      avgSyncDuration,
      lastSyncTime: this.stats.lastSyncTime,
      lastSyncSuccess: this.stats.lastSyncSuccess
    };
  }
  
  on(eventType: SyncEventType, listener: SyncEventListener): void {
    this.listeners.get(eventType)?.add(listener);
  }
  
  off(eventType: SyncEventType, listener: SyncEventListener): void {
    this.listeners.get(eventType)?.delete(listener);
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
  
  isSyncing(): boolean {
    return this.syncInProgress;
  }
  
  async close(): Promise<void> {
    await this.stop();
    this.initialized = false;
    this.config = null;
  }
  
  // Private methods
  
  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new SyncEngineError(
        'Sync engine not initialized',
        SyncEngineErrorCode.NOT_INITIALIZED
      );
    }
  }
  
  private async syncBatch(batchNumber: number): Promise<BatchSyncResult> {
    const batchStartTime = Date.now();
    const batchId = `batch-${Date.now()}-${batchNumber}`;
    
    this.emitEvent({
      type: SyncEventType.BATCH_STARTED,
      timestamp: new Date().toISOString(),
      data: { batchId, batchNumber }
    });
    
    try {
      // Dequeue transactions for this batch
      const transactions = [];
      for (let i = 0; i < this.config!.batchSize!; i++) {
        const tx = await this.queue.dequeue();
        if (!tx) break;
        transactions.push(tx);
      }
      
      if (transactions.length === 0) {
        return this.createEmptyBatchResult(batchId, batchStartTime);
      }
      
      // Prepare sync request
      const syncRequest = {
        transactions: this.config!.enableDeltaSync 
          ? this.prepareDeltaSync(transactions)
          : transactions,
        metadata: {
          batchId,
          batchNumber,
          timestamp: new Date().toISOString()
        }
      };
      
      // Send to server
      const response = await this.sendSyncRequest(syncRequest);
      
      // Process results
      const result = await this.processSyncResponse(response, transactions, batchId, batchStartTime);
      
      this.emitEvent({
        type: SyncEventType.BATCH_COMPLETED,
        timestamp: new Date().toISOString(),
        data: result
      });
      
      return result;
      
    } catch (error) {
      this.emitEvent({
        type: SyncEventType.BATCH_FAILED,
        timestamp: new Date().toISOString(),
        data: { batchId, error }
      });
      
      throw new SyncEngineError(
        `Batch ${batchId} failed`,
        SyncEngineErrorCode.BATCH_FAILED,
        error
      );
    }
  }
  
  private prepareDeltaSync(transactions: any[]): any[] {
    // Delta sync: only include essential fields and changed data
    // Reduces payload size by excluding unchanged metadata
    return transactions.map(tx => {
      const delta: any = {
        id: tx.metadata.id,
        type: tx.metadata.type,
        payload: tx.payload,
        timestamp: tx.metadata.createdAt
      };
      
      // Only include retry info if transaction has been attempted
      if (tx.metadata.attempts > 0) {
        delta.attempts = tx.metadata.attempts;
        delta.lastError = tx.metadata.lastError;
      }
      
      // Include version for conflict detection
      if (tx.metadata.version) {
        delta.version = tx.metadata.version;
      }
      
      // Include hash for integrity verification
      if (tx.metadata.contentHash) {
        delta.contentHash = tx.metadata.contentHash;
      }
      
      return delta;
    });
  }
  
  private async retryFailedTransaction(transactionId: string): Promise<boolean> {
    try {
      // Get transaction from queue
      const tx = await this.queue.peek();
      if (!tx || tx.metadata.id !== transactionId) {
        return false;
      }
      
      // Check retry limit
      const maxRetries = 3;
      if (tx.metadata.attempts >= maxRetries) {
        this.log(`Transaction ${transactionId} exceeded max retries`);
        return false;
      }
      
      // Retry the transaction
      const syncRequest = {
        transactions: [this.prepareDeltaSync([tx])[0]],
        metadata: {
          isRetry: true,
          attempt: tx.metadata.attempts + 1,
          timestamp: new Date().toISOString()
        }
      };
      
      const response = await this.sendSyncRequest(syncRequest);
      
      if (response.synced && response.synced.length > 0) {
        await this.queue.updateStatus(
          transactionId,
          TransactionStatus.SYNCED,
          undefined,
          response.synced[0].serverTransactionId
        );
        return true;
      }
      
      return false;
    } catch (error) {
      this.log(`Retry failed for transaction ${transactionId}: ${error}`);
      return false;
    }
  }
  
  private detectConflict(transaction: any, serverResponse: any): boolean {
    // Conflict detection based on version mismatch
    if (serverResponse.currentVersion && transaction.metadata.version) {
      return serverResponse.currentVersion !== transaction.metadata.version;
    }
    
    // Conflict detection based on content hash
    if (serverResponse.contentHash && transaction.metadata.contentHash) {
      return serverResponse.contentHash !== transaction.metadata.contentHash;
    }
    
    // Conflict detection based on timestamp
    if (serverResponse.lastModified && transaction.metadata.updatedAt) {
      const serverTime = new Date(serverResponse.lastModified).getTime();
      const localTime = new Date(transaction.metadata.updatedAt).getTime();
      return serverTime > localTime;
    }
    
    return false;
  }
  
  private async sendSyncRequest(request: any): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config!.syncTimeout!);
    
    try {
      const response = await fetch(this.config!.syncEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  private async processSyncResponse(
    response: any,
    transactions: any[],
    batchId: string,
    startTime: number
  ): Promise<BatchSyncResult> {
    const synced: SyncResult[] = [];
    const failed: SyncResult[] = [];
    const conflicts: SyncResult[] = [];
    
    // Process synced transactions
    for (const result of response.synced || []) {
      await this.queue.updateStatus(
        result.transactionId,
        TransactionStatus.SYNCED,
        undefined,
        result.serverTransactionId
      );
      synced.push({
        transactionId: result.transactionId,
        success: true,
        serverTransactionId: result.serverTransactionId
      });
    }
    
    // Process failed transactions with retry logic
    for (const result of response.failed || []) {
      const transaction = transactions.find(tx => tx.metadata.id === result.transactionId);
      
      // Attempt retry if configured and within retry limit
      if (this.config!.retryFailedTransactions && transaction) {
        const retrySuccess = await this.retryFailedTransaction(result.transactionId);
        if (retrySuccess) {
          synced.push({
            transactionId: result.transactionId,
            success: true,
            serverTransactionId: result.serverTransactionId
          });
          continue;
        }
      }
      
      // Mark as failed if retry unsuccessful or not configured
      await this.queue.updateStatus(
        result.transactionId,
        TransactionStatus.FAILED,
        result.error
      );
      failed.push({
        transactionId: result.transactionId,
        success: false,
        error: result.error
      });
    }
    
    // Process conflicts with detection logic
    for (const result of response.conflicts || []) {
      const transaction = transactions.find(tx => tx.metadata.id === result.transactionId);
      
      if (transaction && this.detectConflict(transaction, result)) {
        conflicts.push({
          transactionId: result.transactionId,
          success: false,
          conflictData: result.conflictData || result
        });
        
        // Mark transaction as failed due to conflict
        await this.queue.updateStatus(
          result.transactionId,
          TransactionStatus.FAILED,
          'Conflict detected: server data differs from local data'
        );
      }
    }
    
    return {
      batchId,
      synced,
      failed,
      conflicts,
      totalCount: transactions.length,
      successCount: synced.length,
      failureCount: failed.length,
      conflictCount: conflicts.length,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime
    };
  }
  
  private createEmptyBatchResult(batchId: string, startTime: number): BatchSyncResult {
    return {
      batchId,
      synced: [],
      failed: [],
      conflicts: [],
      totalCount: 0,
      successCount: 0,
      failureCount: 0,
      conflictCount: 0,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime
    };
  }
  
  private updateProgress(currentBatch: number, totalBatches: number, totalTransactions: number): void {
    const syncedCount = this.stats.totalTransactionsSynced;
    const percentComplete = (syncedCount / totalTransactions) * 100;
    
    this.progress = {
      currentBatch,
      totalBatches,
      currentTransaction: syncedCount,
      totalTransactions,
      syncedCount,
      failedCount: this.stats.totalTransactionsFailed,
      conflictCount: this.stats.totalConflicts,
      percentComplete,
      estimatedTimeRemaining: null // Could calculate based on avg batch time
    };
    
    this.emitEvent({
      type: SyncEventType.SYNC_PROGRESS,
      timestamp: new Date().toISOString(),
      data: this.progress
    });
  }
  
  private emitEvent(event: SyncEvent): void {
    this.listeners.get(event.type)?.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        this.log(`Event listener error: ${error}`);
      }
    });
  }
  
  private log(message: string): void {
    if (this.config?.debug) {
      console.log(`[SyncEngine] ${message}`);
    }
  }
}
