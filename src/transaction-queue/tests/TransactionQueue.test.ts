/**
 * TXQ-001 — Transaction Queue Unit Tests
 * 
 * Comprehensive test suite for persistent transaction queue.
 * Tests FIFO ordering, persistence, and all queue operations.
 * 
 * @module TransactionQueue.test
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ITransactionQueue,
  TransactionStatus,
  TransactionType,
  TransactionPriority,
  QueueError,
  QueueErrorCode
} from '../interfaces/TransactionQueue';
import { PersistentTransactionQueue } from '../implementations/PersistentTransactionQueue';
import { IndexedDBStorage } from '../../storage/implementations/IndexedDBStorage';

describe('Persistent Transaction Queue', () => {
  let queue: ITransactionQueue;
  let storage: IndexedDBStorage;
  
  const testConfig = {
    maxTransactions: 10000,
    defaultMaxAttempts: 3,
    userId: 'test-user-123',
    deviceId: 'test-device-456',
    debug: false
  };
  
  beforeEach(async () => {
    storage = new IndexedDBStorage();
    await storage.initialize({ databaseName: 'test_queue_db' });
    
    queue = new PersistentTransactionQueue(storage);
    await queue.initialize(testConfig);
  });
  
  afterEach(async () => {
    await queue.clearAll();
    await queue.close();
    await storage.close();
  });
  
  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newQueue = new PersistentTransactionQueue(storage);
      await expect(newQueue.initialize(testConfig)).resolves.not.toThrow();
      expect(newQueue.isInitialized()).toBe(true);
      await newQueue.close();
    });
    
    it('should allow multiple initializations', async () => {
      await expect(queue.initialize(testConfig)).resolves.not.toThrow();
      await expect(queue.initialize(testConfig)).resolves.not.toThrow();
    });
    
    it('should throw error when accessing uninitialized queue', async () => {
      const newQueue = new PersistentTransactionQueue(storage);
      await expect(
        newQueue.enqueue({ resource: 'users', action: 'create', data: {} })
      ).rejects.toThrow(QueueError);
    });
  });
  
  describe('Enqueue Operations', () => {
    it('should enqueue a transaction', async () => {
      const payload = {
        resource: 'users',
        action: 'create',
        data: { name: 'John Doe', email: 'john@example.com' }
      };
      
      const transaction = await queue.enqueue(payload);
      
      expect(transaction.metadata.id).toBeDefined();
      expect(transaction.metadata.status).toBe(TransactionStatus.PENDING);
      expect(transaction.metadata.type).toBe(TransactionType.CREATE);
      expect(transaction.metadata.userId).toBe(testConfig.userId);
      expect(transaction.metadata.deviceId).toBe(testConfig.deviceId);
      expect(transaction.payload).toEqual(payload);
    });
    
    it('should enqueue with custom options', async () => {
      const payload = {
        resource: 'posts',
        action: 'update',
        data: { title: 'Updated Post' }
      };
      
      const options = {
        priority: TransactionPriority.HIGH,
        maxAttempts: 5,
        customMetadata: { source: 'mobile' }
      };
      
      const transaction = await queue.enqueue(payload, options);
      
      expect(transaction.metadata.priority).toBe(TransactionPriority.HIGH);
      expect(transaction.metadata.maxAttempts).toBe(5);
      expect(transaction.metadata.customMetadata).toEqual({ source: 'mobile' });
    });
    
    it('should infer transaction type from action', async () => {
      const createTx = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      expect(createTx.metadata.type).toBe(TransactionType.CREATE);
      
      const updateTx = await queue.enqueue({ resource: 'users', action: 'update', data: {} });
      expect(updateTx.metadata.type).toBe(TransactionType.UPDATE);
      
      const deleteTx = await queue.enqueue({ resource: 'users', action: 'delete', data: {} });
      expect(deleteTx.metadata.type).toBe(TransactionType.DELETE);
      
      const customTx = await queue.enqueue({ resource: 'users', action: 'custom_action', data: {} });
      expect(customTx.metadata.type).toBe(TransactionType.CUSTOM);
    });
    
    it('should reject enqueue when queue is full', async () => {
      // Create queue with small capacity
      const smallQueue = new PersistentTransactionQueue(storage);
      await smallQueue.initialize({ ...testConfig, maxTransactions: 2 });
      
      await smallQueue.enqueue({ resource: 'users', action: 'create', data: {} });
      await smallQueue.enqueue({ resource: 'users', action: 'create', data: {} });
      
      await expect(
        smallQueue.enqueue({ resource: 'users', action: 'create', data: {} })
      ).rejects.toThrow(QueueError);
      
      await smallQueue.close();
    });
  });
  
  describe('Dequeue Operations', () => {
    it('should dequeue transactions in FIFO order', async () => {
      // Enqueue multiple transactions
      const tx1 = await queue.enqueue({ resource: 'users', action: 'create', data: { id: 1 } });
      await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamps
      const tx2 = await queue.enqueue({ resource: 'users', action: 'create', data: { id: 2 } });
      await new Promise(resolve => setTimeout(resolve, 10));
      const tx3 = await queue.enqueue({ resource: 'users', action: 'create', data: { id: 3 } });
      
      // Dequeue should return in FIFO order
      const dequeued1 = await queue.dequeue();
      expect(dequeued1?.metadata.id).toBe(tx1.metadata.id);
      expect(dequeued1?.metadata.status).toBe(TransactionStatus.SYNCING);
      
      const dequeued2 = await queue.dequeue();
      expect(dequeued2?.metadata.id).toBe(tx2.metadata.id);
      
      const dequeued3 = await queue.dequeue();
      expect(dequeued3?.metadata.id).toBe(tx3.metadata.id);
    });
    
    it('should return null when queue is empty', async () => {
      const result = await queue.dequeue();
      expect(result).toBeNull();
    });
    
    it('should update status to syncing on dequeue', async () => {
      const tx = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      
      const dequeued = await queue.dequeue();
      
      expect(dequeued?.metadata.status).toBe(TransactionStatus.SYNCING);
      expect(dequeued?.metadata.syncStartedAt).not.toBeNull();
      expect(dequeued?.metadata.attempts).toBe(1);
    });
  });
  
  describe('Peek Operations', () => {
    it('should peek at next transaction without removing it', async () => {
      const tx = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      
      const peeked = await queue.peek();
      expect(peeked?.metadata.id).toBe(tx.metadata.id);
      expect(peeked?.metadata.status).toBe(TransactionStatus.PENDING);
      
      // Peek again should return same transaction
      const peeked2 = await queue.peek();
      expect(peeked2?.metadata.id).toBe(tx.metadata.id);
    });
    
    it('should return null when queue is empty', async () => {
      const result = await queue.peek();
      expect(result).toBeNull();
    });
  });
  
  describe('Get Operations', () => {
    it('should get transaction by ID', async () => {
      const tx = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      
      const retrieved = await queue.get(tx.metadata.id);
      
      expect(retrieved?.metadata.id).toBe(tx.metadata.id);
      expect(retrieved?.payload).toEqual(tx.payload);
    });
    
    it('should return null for non-existent transaction', async () => {
      const result = await queue.get('non-existent-id');
      expect(result).toBeNull();
    });
  });
  
  describe('Status Update Operations', () => {
    it('should update transaction status', async () => {
      const tx = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      
      await queue.updateStatus(tx.metadata.id, TransactionStatus.SYNCING);
      
      const updated = await queue.get(tx.metadata.id);
      expect(updated?.metadata.status).toBe(TransactionStatus.SYNCING);
    });
    
    it('should update to synced with server transaction ID', async () => {
      const tx = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      await queue.updateStatus(tx.metadata.id, TransactionStatus.SYNCING);
      
      await queue.updateStatus(tx.metadata.id, TransactionStatus.SYNCED, undefined, 'server-tx-123');
      
      const updated = await queue.get(tx.metadata.id);
      expect(updated?.metadata.status).toBe(TransactionStatus.SYNCED);
      expect(updated?.metadata.serverTransactionId).toBe('server-tx-123');
      expect(updated?.metadata.syncCompletedAt).not.toBeNull();
    });
    
    it('should update to failed with error message', async () => {
      const tx = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      await queue.updateStatus(tx.metadata.id, TransactionStatus.SYNCING);
      
      await queue.updateStatus(tx.metadata.id, TransactionStatus.FAILED, 'Network error');
      
      const updated = await queue.get(tx.metadata.id);
      expect(updated?.metadata.status).toBe(TransactionStatus.FAILED);
      expect(updated?.metadata.lastError).toBe('Network error');
    });
    
    it('should reject invalid status transitions', async () => {
      const tx = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      
      // Cannot go from PENDING to SYNCED (must go through SYNCING)
      await expect(
        queue.updateStatus(tx.metadata.id, TransactionStatus.SYNCED)
      ).rejects.toThrow(QueueError);
    });
    
    it('should throw error for non-existent transaction', async () => {
      await expect(
        queue.updateStatus('non-existent-id', TransactionStatus.SYNCING)
      ).rejects.toThrow(QueueError);
    });
  });
  
  describe('Query Operations', () => {
    beforeEach(async () => {
      // Seed test data
      await queue.enqueue({ resource: 'users', action: 'create', data: { id: 1 } });
      await queue.enqueue({ resource: 'posts', action: 'update', data: { id: 2 } });
      await queue.enqueue({ resource: 'comments', action: 'delete', data: { id: 3 } });
    });
    
    it('should query all transactions', async () => {
      const result = await queue.query();
      
      expect(result.transactions.length).toBe(3);
      expect(result.totalCount).toBe(3);
      expect(result.hasMore).toBe(false);
    });
    
    it('should filter by status', async () => {
      const result = await queue.query({ status: TransactionStatus.PENDING });
      
      expect(result.transactions.length).toBe(3);
      expect(result.transactions.every(t => t.metadata.status === TransactionStatus.PENDING)).toBe(true);
    });
    
    it('should filter by multiple statuses', async () => {
      const tx = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      await queue.updateStatus(tx.metadata.id, TransactionStatus.SYNCING);
      
      const result = await queue.query({
        status: [TransactionStatus.PENDING, TransactionStatus.SYNCING]
      });
      
      expect(result.totalCount).toBe(4);
    });
    
    it('should filter by resource', async () => {
      const result = await queue.query({ resource: 'users' });
      
      expect(result.transactions.length).toBe(1);
      expect(result.transactions[0].payload.resource).toBe('users');
    });
    
    it('should paginate results', async () => {
      const page1 = await queue.query({ limit: 2, offset: 0 });
      expect(page1.transactions.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      
      const page2 = await queue.query({ limit: 2, offset: 2 });
      expect(page2.transactions.length).toBe(1);
      expect(page2.hasMore).toBe(false);
    });
    
    it('should sort by timestamp', async () => {
      const result = await queue.query({ sortOrder: 'asc' });
      
      // Verify FIFO ordering
      for (let i = 1; i < result.transactions.length; i++) {
        const prev = result.transactions[i - 1].metadata.queuedAt!;
        const curr = result.transactions[i].metadata.queuedAt!;
        expect(prev <= curr).toBe(true);
      }
    });
  });
  
  describe('Statistics', () => {
    it('should return accurate statistics', async () => {
      await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      await queue.enqueue({ resource: 'posts', action: 'create', data: {} });
      
      const tx = await queue.enqueue({ resource: 'comments', action: 'create', data: {} });
      await queue.updateStatus(tx.metadata.id, TransactionStatus.SYNCING);
      await queue.updateStatus(tx.metadata.id, TransactionStatus.SYNCED);
      
      const stats = await queue.getStats();
      
      expect(stats.totalCount).toBe(3);
      expect(stats.pendingCount).toBe(2);
      expect(stats.syncedCount).toBe(1);
      expect(stats.capacity).toBe(testConfig.maxTransactions);
      expect(stats.availableCapacity).toBe(testConfig.maxTransactions - 3);
    });
  });
  
  describe('Clear Operations', () => {
    beforeEach(async () => {
      const tx1 = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      const tx2 = await queue.enqueue({ resource: 'posts', action: 'create', data: {} });
      const tx3 = await queue.enqueue({ resource: 'comments', action: 'create', data: {} });
      
      await queue.updateStatus(tx1.metadata.id, TransactionStatus.SYNCING);
      await queue.updateStatus(tx1.metadata.id, TransactionStatus.SYNCED);
      
      await queue.updateStatus(tx2.metadata.id, TransactionStatus.SYNCING);
      await queue.updateStatus(tx2.metadata.id, TransactionStatus.FAILED, 'Test error');
    });
    
    it('should clear synced transactions', async () => {
      const count = await queue.clearSynced();
      
      expect(count).toBe(1);
      
      const stats = await queue.getStats();
      expect(stats.syncedCount).toBe(0);
      expect(stats.totalCount).toBe(2);
    });
    
    it('should clear failed transactions', async () => {
      const count = await queue.clearFailed();
      
      expect(count).toBe(1);
      
      const stats = await queue.getStats();
      expect(stats.failedCount).toBe(0);
      expect(stats.totalCount).toBe(2);
    });
    
    it('should clear all transactions', async () => {
      const count = await queue.clearAll();
      
      expect(count).toBe(3);
      
      const stats = await queue.getStats();
      expect(stats.totalCount).toBe(0);
    });
  });
  
  describe('Retry Operations', () => {
    it('should retry a failed transaction', async () => {
      const tx = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      await queue.updateStatus(tx.metadata.id, TransactionStatus.SYNCING);
      await queue.updateStatus(tx.metadata.id, TransactionStatus.FAILED, 'Network error');
      
      await queue.retry(tx.metadata.id);
      
      const updated = await queue.get(tx.metadata.id);
      expect(updated?.metadata.status).toBe(TransactionStatus.PENDING);
      expect(updated?.metadata.lastError).toBeNull();
    });
    
    it('should reject retry for non-failed transaction', async () => {
      const tx = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      
      await expect(queue.retry(tx.metadata.id)).rejects.toThrow(QueueError);
    });
  });
  
  describe('Cancel Operations', () => {
    it('should cancel a pending transaction', async () => {
      const tx = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      
      await queue.cancel(tx.metadata.id);
      
      const updated = await queue.get(tx.metadata.id);
      expect(updated?.metadata.status).toBe(TransactionStatus.CANCELLED);
    });
    
    it('should reject cancel for non-pending transaction', async () => {
      const tx = await queue.enqueue({ resource: 'users', action: 'create', data: {} });
      await queue.updateStatus(tx.metadata.id, TransactionStatus.SYNCING);
      
      await expect(queue.cancel(tx.metadata.id)).rejects.toThrow(QueueError);
    });
  });
  
  describe('Persistence', () => {
    it('should persist transactions across queue restarts', async () => {
      const tx = await queue.enqueue({ resource: 'users', action: 'create', data: { test: 'data' } });
      
      // Close and reopen queue
      await queue.close();
      
      const newQueue = new PersistentTransactionQueue(storage);
      await newQueue.initialize(testConfig);
      
      const retrieved = await newQueue.get(tx.metadata.id);
      expect(retrieved?.metadata.id).toBe(tx.metadata.id);
      expect(retrieved?.payload.data).toEqual({ test: 'data' });
      
      await newQueue.close();
    });
  });
});
