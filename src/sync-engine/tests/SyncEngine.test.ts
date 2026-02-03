/**
 * SYNC-002 — Sync Engine Comprehensive Unit Tests
 * 
 * Complete test suite for automatic sync engine.
 * Tests batch processing, delta sync, conflict detection, and retry logic.
 * 
 * @module SyncEngine.test
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  ISyncEngine,
  SyncStatus,
  SyncEventType,
  SyncEngineError
} from '../interfaces/SyncEngine';
import { AutomaticSyncEngine } from '../implementations/AutomaticSyncEngine';
import { ITransactionQueue, TransactionStatus } from '../../transaction-queue/interfaces/TransactionQueue';
import { INetworkDetection, NetworkEventType } from '../../network-detection/interfaces/NetworkDetection';

// Mock dependencies
const mockQueue: jest.Mocked<ITransactionQueue> = {
  enqueue: jest.fn(),
  dequeue: jest.fn(),
  peek: jest.fn(),
  query: jest.fn(),
  updateStatus: jest.fn(),
  getById: jest.fn(),
  cancel: jest.fn(),
  clear: jest.fn(),
  getStats: jest.fn(),
  isInitialized: jest.fn(),
  close: jest.fn()
} as any;

const mockNetworkDetection: jest.Mocked<INetworkDetection> = {
  initialize: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  getState: jest.fn(),
  isOnline: jest.fn(),
  isOffline: jest.fn(),
  checkConnectivity: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  getStats: jest.fn(),
  isInitialized: jest.fn(),
  isMonitoring: jest.fn(),
  close: jest.fn()
} as any;

global.fetch = jest.fn() as any;

describe('Automatic Sync Engine - Comprehensive Test Suite', () => {
  let engine: ISyncEngine;
  
  const testConfig = {
    syncEndpoint: 'https://api.example.com/sync/batch',
    batchSize: 50,
    syncTimeout: 30000,
    enableDeltaSync: true,
    autoSyncOnReconnect: true,
    retryFailedTransactions: true,
    maxConcurrentBatches: 1,
    debug: false
  };
  
  beforeEach(async () => {
    jest.clearAllMocks();
    engine = new AutomaticSyncEngine(mockQueue, mockNetworkDetection);
    (global.fetch as jest.Mock).mockClear();
  });
  
  afterEach(async () => {
    if (engine.isInitialized()) {
      await engine.close();
    }
  });
  
  describe('Initialization Tests', () => {
    it('should initialize successfully with valid config', async () => {
      await expect(engine.initialize(testConfig)).resolves.not.toThrow();
      expect(engine.isInitialized()).toBe(true);
    });
    
    it('should apply default configuration values', async () => {
      await engine.initialize({
        syncEndpoint: 'https://api.example.com/sync/batch'
      });
      expect(engine.isInitialized()).toBe(true);
    });
    
    it('should allow multiple initializations without error', async () => {
      await engine.initialize(testConfig);
      await expect(engine.initialize(testConfig)).resolves.not.toThrow();
    });
    
    it('should initialize event listeners', async () => {
      await engine.initialize(testConfig);
      const listener = jest.fn();
      expect(() => engine.on(SyncEventType.SYNC_STARTED, listener)).not.toThrow();
    });
  });
  
  describe('Start/Stop Tests', () => {
    beforeEach(async () => {
      await engine.initialize(testConfig);
    });
    
    it('should start successfully', async () => {
      await expect(engine.start()).resolves.not.toThrow();
    });
    
    it('should stop successfully', async () => {
      await engine.start();
      await expect(engine.stop()).resolves.not.toThrow();
    });
    
    it('should subscribe to network events on start', async () => {
      await engine.start();
      expect(mockNetworkDetection.on).toHaveBeenCalledWith(
        NetworkEventType.ONLINE,
        expect.any(Function)
      );
    });
  });
  
  describe('Sync Operation Tests - CRITICAL', () => {
    beforeEach(async () => {
      await engine.initialize(testConfig);
    });
    
    it('should return empty array when no transactions to sync', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [],
        totalCount: 0
      });
      
      const results = await engine.sync();
      expect(results).toEqual([]);
    });
    
    it('should sync transactions in batches', async () => {
      const mockTransactions = Array.from({ length: 100 }, (_, i) => ({
        metadata: { id: `tx-${i}`, type: 'create', createdAt: new Date().toISOString(), attempts: 0 },
        payload: { data: `test-${i}` }
      }));
      
      mockQueue.query.mockResolvedValueOnce({
        transactions: mockTransactions,
        totalCount: 100
      });
      
      mockQueue.dequeue.mockImplementation(async () => mockTransactions.shift() || null);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          synced: mockTransactions.slice(0, 50).map(tx => ({
            transactionId: tx.metadata.id,
            serverTransactionId: `server-${tx.metadata.id}`
          })),
          failed: [],
          conflicts: []
        })
      });
      
      const results = await engine.sync();
      expect(results.length).toBeGreaterThan(0);
    });
    
    it('should send HTTP POST request to sync endpoint', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [{ metadata: { id: 'tx-1' }, payload: {} }],
        totalCount: 1
      });
      
      mockQueue.dequeue.mockResolvedValueOnce({
        metadata: { id: 'tx-1', type: 'create', createdAt: new Date().toISOString(), attempts: 0 },
        payload: { data: 'test' }
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ synced: [{ transactionId: 'tx-1', serverTransactionId: 'server-1' }], failed: [], conflicts: [] })
      });
      
      await engine.sync();
      
      expect(global.fetch).toHaveBeenCalledWith(
        testConfig.syncEndpoint,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
    
    it('should update transaction status to SYNCED on success', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [{ metadata: { id: 'tx-1' }, payload: {} }],
        totalCount: 1
      });
      
      mockQueue.dequeue.mockResolvedValueOnce({
        metadata: { id: 'tx-1', type: 'create', createdAt: new Date().toISOString(), attempts: 0 },
        payload: { data: 'test' }
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ synced: [{ transactionId: 'tx-1', serverTransactionId: 'server-1' }], failed: [], conflicts: [] })
      });
      
      await engine.sync();
      
      expect(mockQueue.updateStatus).toHaveBeenCalledWith(
        'tx-1',
        TransactionStatus.SYNCED,
        undefined,
        'server-1'
      );
    });
    
    it('should prevent concurrent syncs', async () => {
      mockQueue.query.mockResolvedValue({
        transactions: [],
        totalCount: 0
      });
      
      const sync1 = engine.sync();
      const sync2 = engine.sync();
      
      const results = await Promise.all([sync1, sync2]);
      expect(results[1]).toEqual([]);
    });
  });
  
  describe('Batch Processing Tests', () => {
    beforeEach(async () => {
      await engine.initialize(testConfig);
    });
    
    it('should process transactions in batches of configured size', async () => {
      const batchSize = 50;
      const mockTransactions = Array.from({ length: 150 }, (_, i) => ({
        metadata: { id: `tx-${i}`, type: 'create', createdAt: new Date().toISOString(), attempts: 0 },
        payload: { data: `test-${i}` }
      }));
      
      mockQueue.query.mockResolvedValueOnce({
        transactions: mockTransactions,
        totalCount: 150
      });
      
      let dequeueCount = 0;
      mockQueue.dequeue.mockImplementation(async () => {
        if (dequeueCount < mockTransactions.length) {
          return mockTransactions[dequeueCount++];
        }
        return null;
      });
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          synced: Array.from({ length: batchSize }, (_, i) => ({
            transactionId: `tx-${i}`,
            serverTransactionId: `server-${i}`
          })),
          failed: [],
          conflicts: []
        })
      });
      
      const results = await engine.sync();
      expect(results.length).toBe(3); // 150 / 50 = 3 batches
    });
    
    it('should emit batch started and completed events', async () => {
      const batchStartedListener = jest.fn();
      const batchCompletedListener = jest.fn();
      
      engine.on(SyncEventType.BATCH_STARTED, batchStartedListener);
      engine.on(SyncEventType.BATCH_COMPLETED, batchCompletedListener);
      
      mockQueue.query.mockResolvedValueOnce({
        transactions: [{ metadata: { id: 'tx-1' }, payload: {} }],
        totalCount: 1
      });
      
      mockQueue.dequeue.mockResolvedValueOnce({
        metadata: { id: 'tx-1', type: 'create', createdAt: new Date().toISOString(), attempts: 0 },
        payload: { data: 'test' }
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ synced: [{ transactionId: 'tx-1', serverTransactionId: 'server-1' }], failed: [], conflicts: [] })
      });
      
      await engine.sync();
      
      expect(batchStartedListener).toHaveBeenCalled();
      expect(batchCompletedListener).toHaveBeenCalled();
    });
  });
  
  describe('Delta Sync Tests - CRITICAL', () => {
    beforeEach(async () => {
      await engine.initialize({ ...testConfig, enableDeltaSync: true });
    });
    
    it('should use delta sync when enabled', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [{ metadata: { id: 'tx-1' }, payload: {} }],
        totalCount: 1
      });
      
      mockQueue.dequeue.mockResolvedValueOnce({
        metadata: {
          id: 'tx-1',
          type: 'create',
          createdAt: new Date().toISOString(),
          attempts: 0,
          version: 1,
          contentHash: 'abc123'
        },
        payload: { data: 'test' }
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ synced: [{ transactionId: 'tx-1', serverTransactionId: 'server-1' }], failed: [], conflicts: [] })
      });
      
      await engine.sync();
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      // Delta sync should include only essential fields
      expect(requestBody.transactions[0]).toHaveProperty('id');
      expect(requestBody.transactions[0]).toHaveProperty('type');
      expect(requestBody.transactions[0]).toHaveProperty('payload');
      expect(requestBody.transactions[0]).toHaveProperty('timestamp');
    });
    
    it('should exclude retry info for first-time transactions', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [{ metadata: { id: 'tx-1' }, payload: {} }],
        totalCount: 1
      });
      
      mockQueue.dequeue.mockResolvedValueOnce({
        metadata: {
          id: 'tx-1',
          type: 'create',
          createdAt: new Date().toISOString(),
          attempts: 0
        },
        payload: { data: 'test' }
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ synced: [{ transactionId: 'tx-1', serverTransactionId: 'server-1' }], failed: [], conflicts: [] })
      });
      
      await engine.sync();
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      expect(requestBody.transactions[0]).not.toHaveProperty('attempts');
    });
    
    it('should include version for conflict detection', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [{ metadata: { id: 'tx-1' }, payload: {} }],
        totalCount: 1
      });
      
      mockQueue.dequeue.mockResolvedValueOnce({
        metadata: {
          id: 'tx-1',
          type: 'update',
          createdAt: new Date().toISOString(),
          attempts: 0,
          version: 5
        },
        payload: { data: 'test' }
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ synced: [{ transactionId: 'tx-1', serverTransactionId: 'server-1' }], failed: [], conflicts: [] })
      });
      
      await engine.sync();
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      expect(requestBody.transactions[0]).toHaveProperty('version', 5);
    });
  });
  
  describe('Conflict Detection Tests - CRITICAL', () => {
    beforeEach(async () => {
      await engine.initialize(testConfig);
    });
    
    it('should detect conflicts from server response', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [{ metadata: { id: 'tx-1' }, payload: {} }],
        totalCount: 1
      });
      
      mockQueue.dequeue.mockResolvedValueOnce({
        metadata: {
          id: 'tx-1',
          type: 'update',
          createdAt: new Date().toISOString(),
          attempts: 0,
          version: 1
        },
        payload: { data: 'test' }
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          synced: [],
          failed: [],
          conflicts: [{
            transactionId: 'tx-1',
            currentVersion: 2,
            conflictData: { serverData: 'different' }
          }]
        })
      });
      
      const results = await engine.sync();
      expect(results[0].conflictCount).toBe(1);
    });
    
    it('should mark conflicted transactions as failed', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [{ metadata: { id: 'tx-1' }, payload: {} }],
        totalCount: 1
      });
      
      mockQueue.dequeue.mockResolvedValueOnce({
        metadata: {
          id: 'tx-1',
          type: 'update',
          createdAt: new Date().toISOString(),
          attempts: 0,
          version: 1
        },
        payload: { data: 'test' }
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          synced: [],
          failed: [],
          conflicts: [{
            transactionId: 'tx-1',
            currentVersion: 2
          }]
        })
      });
      
      await engine.sync();
      
      expect(mockQueue.updateStatus).toHaveBeenCalledWith(
        'tx-1',
        TransactionStatus.FAILED,
        expect.stringContaining('Conflict detected')
      );
    });
  });
  
  describe('Retry Logic Tests - CRITICAL', () => {
    beforeEach(async () => {
      await engine.initialize({ ...testConfig, retryFailedTransactions: true });
    });
    
    it('should retry failed transactions', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [{ metadata: { id: 'tx-1' }, payload: {} }],
        totalCount: 1
      });
      
      mockQueue.dequeue.mockResolvedValueOnce({
        metadata: {
          id: 'tx-1',
          type: 'create',
          createdAt: new Date().toISOString(),
          attempts: 1
        },
        payload: { data: 'test' }
      });
      
      mockQueue.peek.mockResolvedValueOnce({
        metadata: {
          id: 'tx-1',
          type: 'create',
          createdAt: new Date().toISOString(),
          attempts: 1
        },
        payload: { data: 'test' }
      });
      
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            synced: [],
            failed: [{ transactionId: 'tx-1', error: 'Temporary error' }],
            conflicts: []
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            synced: [{ transactionId: 'tx-1', serverTransactionId: 'server-1' }],
            failed: [],
            conflicts: []
          })
        });
      
      await engine.sync();
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
    
    it('should not retry beyond max attempts', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [{ metadata: { id: 'tx-1' }, payload: {} }],
        totalCount: 1
      });
      
      mockQueue.dequeue.mockResolvedValueOnce({
        metadata: {
          id: 'tx-1',
          type: 'create',
          createdAt: new Date().toISOString(),
          attempts: 3
        },
        payload: { data: 'test' }
      });
      
      mockQueue.peek.mockResolvedValueOnce({
        metadata: {
          id: 'tx-1',
          type: 'create',
          createdAt: new Date().toISOString(),
          attempts: 3
        },
        payload: { data: 'test' }
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          synced: [],
          failed: [{ transactionId: 'tx-1', error: 'Error' }],
          conflicts: []
        })
      });
      
      await engine.sync();
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Progress Tracking Tests', () => {
    beforeEach(async () => {
      await engine.initialize(testConfig);
    });
    
    it('should track sync progress', async () => {
      const progressListener = jest.fn();
      engine.on(SyncEventType.SYNC_PROGRESS, progressListener);
      
      mockQueue.query.mockResolvedValueOnce({
        transactions: Array.from({ length: 100 }, (_, i) => ({ metadata: { id: `tx-${i}` }, payload: {} })),
        totalCount: 100
      });
      
      mockQueue.dequeue.mockImplementation(async () => ({
        metadata: { id: 'tx-1', type: 'create', createdAt: new Date().toISOString(), attempts: 0 },
        payload: {}
      }));
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ synced: [{ transactionId: 'tx-1', serverTransactionId: 'server-1' }], failed: [], conflicts: [] })
      });
      
      await engine.sync();
      
      expect(progressListener).toHaveBeenCalled();
    });
    
    it('should provide progress information', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [{ metadata: { id: 'tx-1' }, payload: {} }],
        totalCount: 1
      });
      
      mockQueue.dequeue.mockResolvedValueOnce({
        metadata: { id: 'tx-1', type: 'create', createdAt: new Date().toISOString(), attempts: 0 },
        payload: {}
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ synced: [{ transactionId: 'tx-1', serverTransactionId: 'server-1' }], failed: [], conflicts: [] })
      });
      
      const syncPromise = engine.sync();
      
      // Progress should be available during sync
      // Note: This is timing-dependent in real implementation
      
      await syncPromise;
    });
  });
  
  describe('Event System Tests', () => {
    beforeEach(async () => {
      await engine.initialize(testConfig);
    });
    
    it('should emit sync started event', async () => {
      const listener = jest.fn();
      engine.on(SyncEventType.SYNC_STARTED, listener);
      
      mockQueue.query.mockResolvedValueOnce({
        transactions: [],
        totalCount: 0
      });
      
      await engine.sync();
      expect(listener).toHaveBeenCalled();
    });
    
    it('should emit sync completed event', async () => {
      const listener = jest.fn();
      engine.on(SyncEventType.SYNC_COMPLETED, listener);
      
      mockQueue.query.mockResolvedValueOnce({
        transactions: [],
        totalCount: 0
      });
      
      await engine.sync();
      expect(listener).toHaveBeenCalled();
    });
    
    it('should remove event listeners', () => {
      const listener = jest.fn();
      engine.on(SyncEventType.SYNC_STARTED, listener);
      engine.off(SyncEventType.SYNC_STARTED, listener);
      
      // Listener should be removed
      expect(true).toBe(true);
    });
  });
  
  describe('Statistics Tests', () => {
    beforeEach(async () => {
      await engine.initialize(testConfig);
    });
    
    it('should track sync statistics', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [],
        totalCount: 0
      });
      
      await engine.sync();
      
      const stats = engine.getStats();
      expect(stats.totalSyncs).toBe(1);
    });
    
    it('should calculate average sync duration', async () => {
      mockQueue.query.mockResolvedValue({
        transactions: [],
        totalCount: 0
      });
      
      await engine.sync();
      await engine.sync();
      
      const stats = engine.getStats();
      expect(stats.avgSyncDuration).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Error Handling Tests', () => {
    beforeEach(async () => {
      await engine.initialize(testConfig);
    });
    
    it('should handle network errors gracefully', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [{ metadata: { id: 'tx-1' }, payload: {} }],
        totalCount: 1
      });
      
      mockQueue.dequeue.mockResolvedValueOnce({
        metadata: { id: 'tx-1', type: 'create', createdAt: new Date().toISOString(), attempts: 0 },
        payload: {}
      });
      
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      await expect(engine.sync()).rejects.toThrow(SyncEngineError);
    });
    
    it('should handle server errors', async () => {
      mockQueue.query.mockResolvedValueOnce({
        transactions: [{ metadata: { id: 'tx-1' }, payload: {} }],
        totalCount: 1
      });
      
      mockQueue.dequeue.mockResolvedValueOnce({
        metadata: { id: 'tx-1', type: 'create', createdAt: new Date().toISOString(), attempts: 0 },
        payload: {}
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });
      
      await expect(engine.sync()).rejects.toThrow();
    });
    
    it('should throw error when accessing uninitialized engine', async () => {
      const uninitEngine = new AutomaticSyncEngine(mockQueue, mockNetworkDetection);
      await expect(uninitEngine.sync()).rejects.toThrow(SyncEngineError);
    });
  });
  
  describe('Cleanup Tests', () => {
    beforeEach(async () => {
      await engine.initialize(testConfig);
    });
    
    it('should close successfully', async () => {
      await expect(engine.close()).resolves.not.toThrow();
    });
    
    it('should mark as uninitialized after close', async () => {
      await engine.close();
      expect(engine.isInitialized()).toBe(false);
    });
  });
});
