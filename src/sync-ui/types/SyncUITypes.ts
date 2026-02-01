/**
 * SYNC-004 — Sync Progress & Error Visibility Types
 * 
 * Type definitions for sync UI components.
 * 
 * @module SyncUITypes
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import { SyncStatus, SyncProgress, SyncStats } from '../../sync-engine/interfaces/SyncEngine';

/**
 * Sync display status for UI
 */
export enum SyncDisplayStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ERROR = 'error',
  PARTIAL_FAILURE = 'partial_failure'
}

/**
 * Sync notification type
 */
export enum SyncNotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error'
}

/**
 * Failed transaction details for display
 */
export interface FailedTransaction {
  id: string;
  type: string;
  error: string;
  timestamp: string;
  retryable: boolean;
  attempts: number;
  maxAttempts: number;
}

/**
 * Sync notification
 */
export interface SyncNotification {
  id: string;
  type: SyncNotificationType;
  title: string;
  message: string;
  timestamp: string;
  dismissible: boolean;
  autoHide?: boolean;
  duration?: number;
}

/**
 * Sync UI state
 */
export interface SyncUIState {
  status: SyncDisplayStatus;
  progress: SyncProgress | null;
  stats: SyncStats | null;
  failedTransactions: FailedTransaction[];
  notifications: SyncNotification[];
  isVisible: boolean;
  isExpanded: boolean;
}

/**
 * Sync UI configuration
 */
export interface SyncUIConfig {
  position: 'top' | 'bottom' | 'floating';
  theme: 'light' | 'dark' | 'auto';
  showNotifications: boolean;
  autoHideSuccess: boolean;
  successDuration: number;
  showProgress: boolean;
  showETA: boolean;
  showFailedTransactions: boolean;
  maxFailedTransactionsDisplay: number;
}

/**
 * Sync UI controls
 */
export interface SyncUIControls {
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  retry: (transactionId?: string) => Promise<void>;
  retryAll: () => Promise<void>;
  cancel: () => Promise<void>;
  dismiss: (notificationId: string) => void;
  toggle: () => void;
  expand: () => void;
  collapse: () => void;
}

/**
 * Sync UI props
 */
export interface SyncUIProps {
  config?: Partial<SyncUIConfig>;
  onStatusChange?: (status: SyncDisplayStatus) => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: React.CSSProperties;
}
