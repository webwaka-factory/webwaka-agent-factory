/**
 * SYNC-004 — Sync UI Sub-Components
 * 
 * Supporting components for sync status display.
 * 
 * @module SyncUIComponents
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import React from 'react';
import { SyncProgress } from '../../sync-engine/interfaces/SyncEngine';
import { FailedTransaction, SyncNotification, SyncDisplayStatus, SyncUIControls } from '../types/SyncUITypes';

// Progress Indicator Component
export interface SyncProgressIndicatorProps {
  progress: SyncProgress;
  showETA: boolean;
}

export const SyncProgressIndicator: React.FC<SyncProgressIndicatorProps> = ({ progress, showETA }) => {
  const formatETA = (ms: number | null) => {
    if (!ms) return 'Calculating...';
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m`;
  };
  
  return (
    <div className="sync-progress-indicator">
      <div className="progress-info">
        <span className="progress-text">
          {progress.syncedCount} of {progress.totalTransactions} transactions
        </span>
        {showETA && progress.estimatedTimeRemaining && (
          <span className="progress-eta">
            ETA: {formatETA(progress.estimatedTimeRemaining)}
          </span>
        )}
      </div>
      <div className="progress-bar-container">
        <div 
          className="progress-bar"
          style={{ width: `${progress.percentComplete}%` }}
          role="progressbar"
          aria-valuenow={progress.percentComplete}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="progress-details">
        <span className="progress-percent">{Math.round(progress.percentComplete)}%</span>
        {progress.failedCount > 0 && (
          <span className="progress-failed">{progress.failedCount} failed</span>
        )}
      </div>
    </div>
  );
};

// Error Display Component
export interface SyncErrorDisplayProps {
  failedTransactions: FailedTransaction[];
  onRetry: (transactionId: string) => Promise<void>;
  onRetryAll: () => Promise<void>;
}

export const SyncErrorDisplay: React.FC<SyncErrorDisplayProps> = ({
  failedTransactions,
  onRetry,
  onRetryAll
}) => {
  return (
    <div className="sync-error-display">
      <div className="error-header">
        <h4>Failed Transactions ({failedTransactions.length})</h4>
        <button 
          className="btn-retry-all"
          onClick={onRetryAll}
        >
          Retry All
        </button>
      </div>
      <div className="error-list">
        {failedTransactions.map(tx => (
          <div key={tx.id} className="error-item">
            <div className="error-info">
              <span className="error-id">{tx.id}</span>
              <span className="error-type">{tx.type}</span>
              <span className="error-message">{tx.error}</span>
              <span className="error-attempts">
                Attempt {tx.attempts}/{tx.maxAttempts}
              </span>
            </div>
            {tx.retryable && tx.attempts < tx.maxAttempts && (
              <button
                className="btn-retry"
                onClick={() => onRetry(tx.id)}
              >
                Retry
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Controls Component
export interface SyncControlsProps {
  status: SyncDisplayStatus;
  controls: SyncUIControls;
  hasFailedTransactions: boolean;
}

export const SyncControls: React.FC<SyncControlsProps> = ({
  status,
  controls,
  hasFailedTransactions
}) => {
  return (
    <div className="sync-controls">
      {status === SyncDisplayStatus.SYNCING && (
        <button 
          className="btn-control btn-pause"
          onClick={controls.pause}
          title="Pause sync"
        >
          ⏸ Pause
        </button>
      )}
      
      {status === SyncDisplayStatus.PAUSED && (
        <button 
          className="btn-control btn-resume"
          onClick={controls.resume}
          title="Resume sync"
        >
          ▶ Resume
        </button>
      )}
      
      {(status === SyncDisplayStatus.ERROR || 
        status === SyncDisplayStatus.PARTIAL_FAILURE ||
        hasFailedTransactions) && (
        <button 
          className="btn-control btn-retry"
          onClick={controls.retryAll}
          title="Retry failed transactions"
        >
          🔄 Retry
        </button>
      )}
      
      {status === SyncDisplayStatus.SYNCING && (
        <button 
          className="btn-control btn-cancel"
          onClick={controls.cancel}
          title="Cancel sync"
        >
          ✕ Cancel
        </button>
      )}
    </div>
  );
};

// Notifications Component
export interface SyncNotificationsProps {
  notifications: SyncNotification[];
  onDismiss: (id: string) => void;
}

export const SyncNotifications: React.FC<SyncNotificationsProps> = ({
  notifications,
  onDismiss
}) => {
  if (notifications.length === 0) return null;
  
  return (
    <div className="sync-notifications">
      {notifications.map(notification => (
        <div 
          key={notification.id}
          className={`notification notification-${notification.type}`}
          role="alert"
        >
          <div className="notification-content">
            <strong className="notification-title">{notification.title}</strong>
            <p className="notification-message">{notification.message}</p>
            <span className="notification-time">
              {new Date(notification.timestamp).toLocaleTimeString()}
            </span>
          </div>
          {notification.dismissible && (
            <button
              className="notification-dismiss"
              onClick={() => onDismiss(notification.id)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
