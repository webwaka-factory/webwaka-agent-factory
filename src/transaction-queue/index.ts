/**
 * TXQ-001 — Persistent Offline Transaction Queue
 * 
 * Main module exports for the transaction queue.
 * 
 * @module @webwaka/transaction-queue
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

// Export interfaces and types
export {
  ITransactionQueue,
  ITransactionQueueWithEvents,
  Transaction,
  TransactionPayload,
  TransactionMetadata,
  TransactionOptions,
  TransactionQueryOptions,
  TransactionQueryResult,
  TransactionStatus,
  TransactionType,
  TransactionPriority,
  QueueStats,
  QueueConfig,
  QueueError,
  QueueErrorCode,
  TransactionEvent,
  TransactionEventType,
  TransactionEventListener
} from './interfaces/TransactionQueue';

// Export implementation
export { PersistentTransactionQueue } from './implementations/PersistentTransactionQueue';

// Export version
export const VERSION = '1.0.0';
