/**
 * SYNC-004 — Sync Status Bar Component
 * 
 * Main UI component for displaying sync status, progress, and controls.
 * 
 * @module SyncStatusBar
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import React from 'react';
import { useSyncUI } from '../hooks/useSyncUI';
import { SyncUIProps, SyncDisplayStatus } from '../types/SyncUITypes';
import { ISyncEngine } from '../../sync-engine/interfaces/SyncEngine';
import { 
  SyncProgressIndicator,
  SyncErrorDisplay,
  SyncControls,
  SyncNotifications
} from './SyncUIComponents';

export interface SyncStatusBarProps extends SyncUIProps {
  syncEngine: ISyncEngine;
}

export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({
  syncEngine,
  config,
  onStatusChange,
  onError,
  className = '',
  style = {}
}) => {
  const [state, controls] = useSyncUI(syncEngine, config);
  
  // Notify status changes
  React.useEffect(() => {
    if (onStatusChange) {
      onStatusChange(state.status);
    }
  }, [state.status, onStatusChange]);
  
  // Don't render if not visible
  if (!state.isVisible) {
    return null;
  }
  
  const getStatusColor = () => {
    switch (state.status) {
      case SyncDisplayStatus.SYNCING:
        return 'blue';
      case SyncDisplayStatus.COMPLETED:
        return 'green';
      case SyncDisplayStatus.ERROR:
        return 'red';
      case SyncDisplayStatus.PARTIAL_FAILURE:
        return 'orange';
      case SyncDisplayStatus.PAUSED:
        return 'gray';
      default:
        return 'gray';
    }
  };
  
  const getStatusText = () => {
    switch (state.status) {
      case SyncDisplayStatus.SYNCING:
        return 'Syncing...';
      case SyncDisplayStatus.COMPLETED:
        return 'Sync Complete';
      case SyncDisplayStatus.ERROR:
        return 'Sync Failed';
      case SyncDisplayStatus.PARTIAL_FAILURE:
        return 'Sync Completed with Errors';
      case SyncDisplayStatus.PAUSED:
        return 'Sync Paused';
      default:
        return 'Ready';
    }
  };
  
  return (
    <div 
      className={`sync-status-bar ${className} ${state.isExpanded ? 'expanded' : ''}`}
      style={style}
      data-status={state.status}
    >
      {/* Status Indicator */}
      <div className="sync-status-indicator">
        <div 
          className={`status-dot status-${getStatusColor()}`}
          aria-label={getStatusText()}
        />
        <span className="status-text">{getStatusText()}</span>
      </div>
      
      {/* Progress Display */}
      {state.progress && (
        <SyncProgressIndicator 
          progress={state.progress}
          showETA={config?.showETA ?? true}
        />
      )}
      
      {/* Stats Display */}
      {state.stats && !state.progress && (
        <div className="sync-stats">
          <span className="stat">
            <strong>{state.stats.totalTransactionsSynced}</strong> synced
          </span>
          {state.stats.totalTransactionsFailed > 0 && (
            <span className="stat stat-error">
              <strong>{state.stats.totalTransactionsFailed}</strong> failed
            </span>
          )}
        </div>
      )}
      
      {/* Controls */}
      <SyncControls 
        status={state.status}
        controls={controls}
        hasFailedTransactions={state.failedTransactions.length > 0}
      />
      
      {/* Expand/Collapse Button */}
      <button
        className="expand-button"
        onClick={state.isExpanded ? controls.collapse : controls.expand}
        aria-label={state.isExpanded ? 'Collapse' : 'Expand'}
      >
        {state.isExpanded ? '▲' : '▼'}
      </button>
      
      {/* Expanded Content */}
      {state.isExpanded && (
        <div className="sync-expanded-content">
          {/* Error Display */}
          {state.failedTransactions.length > 0 && (
            <SyncErrorDisplay 
              failedTransactions={state.failedTransactions}
              onRetry={controls.retry}
              onRetryAll={controls.retryAll}
            />
          )}
          
          {/* Detailed Stats */}
          {state.stats && (
            <div className="sync-detailed-stats">
              <h4>Sync Statistics</h4>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Total Syncs:</span>
                  <span className="stat-value">{state.stats.totalSyncs}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Successful:</span>
                  <span className="stat-value">{state.stats.successfulSyncs}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Failed:</span>
                  <span className="stat-value">{state.stats.failedSyncs}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Avg Duration:</span>
                  <span className="stat-value">{Math.round(state.stats.avgSyncDuration)}ms</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Last Sync:</span>
                  <span className="stat-value">
                    {state.stats.lastSyncTime 
                      ? new Date(state.stats.lastSyncTime).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Notifications */}
      <SyncNotifications 
        notifications={state.notifications}
        onDismiss={controls.dismiss}
      />
    </div>
  );
};
