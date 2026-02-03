/**
 * SYNC-004 — Sync UI Hook
 * 
 * React hook for managing sync UI state and controls.
 * 
 * @module useSyncUI
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SyncUIState,
  SyncUIConfig,
  SyncUIControls,
  SyncDisplayStatus,
  SyncNotification,
  SyncNotificationType,
  FailedTransaction
} from '../types/SyncUITypes';
import { ISyncEngine, SyncEventType, SyncStatus } from '../../sync-engine/interfaces/SyncEngine';

const DEFAULT_CONFIG: SyncUIConfig = {
  position: 'top',
  theme: 'auto',
  showNotifications: true,
  autoHideSuccess: true,
  successDuration: 5000,
  showProgress: true,
  showETA: true,
  showFailedTransactions: true,
  maxFailedTransactionsDisplay: 10
};

export function useSyncUI(
  syncEngine: ISyncEngine,
  config: Partial<SyncUIConfig> = {}
): [SyncUIState, SyncUIControls] {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const notificationIdCounter = useRef(0);
  
  const [state, setState] = useState<SyncUIState>({
    status: SyncDisplayStatus.IDLE,
    progress: null,
    stats: null,
    failedTransactions: [],
    notifications: [],
    isVisible: true,
    isExpanded: false
  });
  
  // Generate unique notification ID
  const generateNotificationId = useCallback(() => {
    return `notification-${Date.now()}-${notificationIdCounter.current++}`;
  }, []);
  
  // Add notification
  const addNotification = useCallback((
    type: SyncNotificationType,
    title: string,
    message: string,
    options: Partial<SyncNotification> = {}
  ) => {
    const notification: SyncNotification = {
      id: generateNotificationId(),
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      dismissible: true,
      autoHide: type === SyncNotificationType.SUCCESS && fullConfig.autoHideSuccess,
      duration: fullConfig.successDuration,
      ...options
    };
    
    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, notification]
    }));
    
    // Auto-hide if configured
    if (notification.autoHide && notification.duration) {
      setTimeout(() => {
        dismissNotification(notification.id);
      }, notification.duration);
    }
  }, [fullConfig, generateNotificationId]);
  
  // Dismiss notification
  const dismissNotification = useCallback((notificationId: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== notificationId)
    }));
  }, []);
  
  // Update failed transactions
  const updateFailedTransactions = useCallback((failed: FailedTransaction[]) => {
    setState(prev => ({
      ...prev,
      failedTransactions: failed.slice(0, fullConfig.maxFailedTransactionsDisplay)
    }));
  }, [fullConfig]);
  
  // Map sync status to display status
  const mapSyncStatus = useCallback((syncStatus: SyncStatus, hasFailures: boolean): SyncDisplayStatus => {
    switch (syncStatus) {
      case SyncStatus.IDLE:
        return SyncDisplayStatus.IDLE;
      case SyncStatus.SYNCING:
        return SyncDisplayStatus.SYNCING;
      case SyncStatus.PAUSED:
        return SyncDisplayStatus.PAUSED;
      case SyncStatus.ERROR:
        return SyncDisplayStatus.ERROR;
      case SyncStatus.COMPLETED:
        return hasFailures ? SyncDisplayStatus.PARTIAL_FAILURE : SyncDisplayStatus.COMPLETED;
      default:
        return SyncDisplayStatus.IDLE;
    }
  }, []);
  
  // Setup event listeners
  useEffect(() => {
    if (!syncEngine.isInitialized()) return;
    
    // Sync started
    const onSyncStarted = () => {
      setState(prev => ({
        ...prev,
        status: SyncDisplayStatus.SYNCING,
        progress: null,
        failedTransactions: []
      }));
      
      if (fullConfig.showNotifications) {
        addNotification(
          SyncNotificationType.INFO,
          'Sync Started',
          'Synchronizing offline data with server...'
        );
      }
    };
    
    // Sync progress
    const onSyncProgress = (event: any) => {
      const progress = event.data;
      setState(prev => ({
        ...prev,
        progress,
        stats: syncEngine.getStats()
      }));
    };
    
    // Sync completed
    const onSyncCompleted = (event: any) => {
      const stats = syncEngine.getStats();
      const hasFailures = stats.totalTransactionsFailed > 0;
      
      setState(prev => ({
        ...prev,
        status: hasFailures ? SyncDisplayStatus.PARTIAL_FAILURE : SyncDisplayStatus.COMPLETED,
        progress: null,
        stats
      }));
      
      if (fullConfig.showNotifications) {
        if (hasFailures) {
          addNotification(
            SyncNotificationType.WARNING,
            'Sync Completed with Errors',
            `${stats.totalTransactionsSynced} synced, ${stats.totalTransactionsFailed} failed`
          );
        } else {
          addNotification(
            SyncNotificationType.SUCCESS,
            'Sync Completed',
            `Successfully synced ${stats.totalTransactionsSynced} transactions`
          );
        }
      }
    };
    
    // Sync failed
    const onSyncFailed = (event: any) => {
      setState(prev => ({
        ...prev,
        status: SyncDisplayStatus.ERROR,
        progress: null
      }));
      
      if (fullConfig.showNotifications) {
        addNotification(
          SyncNotificationType.ERROR,
          'Sync Failed',
          event.data?.error?.message || 'An error occurred during sync'
        );
      }
    };
    
    // Sync paused
    const onSyncPaused = () => {
      setState(prev => ({
        ...prev,
        status: SyncDisplayStatus.PAUSED
      }));
      
      if (fullConfig.showNotifications) {
        addNotification(
          SyncNotificationType.INFO,
          'Sync Paused',
          'Synchronization has been paused'
        );
      }
    };
    
    // Sync resumed
    const onSyncResumed = () => {
      setState(prev => ({
        ...prev,
        status: SyncDisplayStatus.SYNCING
      }));
      
      if (fullConfig.showNotifications) {
        addNotification(
          SyncNotificationType.INFO,
          'Sync Resumed',
          'Synchronization has been resumed'
        );
      }
    };
    
    // Batch failed
    const onBatchFailed = (event: any) => {
      const batchResult = event.data;
      if (batchResult?.failed && fullConfig.showFailedTransactions) {
        const failedTxs: FailedTransaction[] = batchResult.failed.map((f: any) => ({
          id: f.transactionId,
          type: f.type || 'unknown',
          error: f.error || 'Unknown error',
          timestamp: new Date().toISOString(),
          retryable: true,
          attempts: f.attempts || 0,
          maxAttempts: 3
        }));
        
        updateFailedTransactions(failedTxs);
      }
    };
    
    // Register event listeners
    syncEngine.on(SyncEventType.SYNC_STARTED, onSyncStarted);
    syncEngine.on(SyncEventType.SYNC_PROGRESS, onSyncProgress);
    syncEngine.on(SyncEventType.SYNC_COMPLETED, onSyncCompleted);
    syncEngine.on(SyncEventType.SYNC_FAILED, onSyncFailed);
    syncEngine.on(SyncEventType.SYNC_PAUSED, onSyncPaused);
    syncEngine.on(SyncEventType.SYNC_RESUMED, onSyncResumed);
    syncEngine.on(SyncEventType.BATCH_FAILED, onBatchFailed);
    
    // Cleanup
    return () => {
      syncEngine.off(SyncEventType.SYNC_STARTED, onSyncStarted);
      syncEngine.off(SyncEventType.SYNC_PROGRESS, onSyncProgress);
      syncEngine.off(SyncEventType.SYNC_COMPLETED, onSyncCompleted);
      syncEngine.off(SyncEventType.SYNC_FAILED, onSyncFailed);
      syncEngine.off(SyncEventType.SYNC_PAUSED, onSyncPaused);
      syncEngine.off(SyncEventType.SYNC_RESUMED, onSyncResumed);
      syncEngine.off(SyncEventType.BATCH_FAILED, onBatchFailed);
    };
  }, [syncEngine, fullConfig, addNotification, updateFailedTransactions]);
  
  // Controls
  const controls: SyncUIControls = {
    pause: useCallback(async () => {
      await syncEngine.pause();
    }, [syncEngine]),
    
    resume: useCallback(async () => {
      await syncEngine.resume();
    }, [syncEngine]),
    
    retry: useCallback(async (transactionId?: string) => {
      // Retry specific transaction or trigger full sync
      if (transactionId) {
        // Implementation depends on sync engine retry API
        addNotification(
          SyncNotificationType.INFO,
          'Retrying Transaction',
          `Retrying transaction ${transactionId}...`
        );
      }
      await syncEngine.sync();
    }, [syncEngine, addNotification]),
    
    retryAll: useCallback(async () => {
      addNotification(
        SyncNotificationType.INFO,
        'Retrying All',
        'Retrying all failed transactions...'
      );
      await syncEngine.sync();
    }, [syncEngine, addNotification]),
    
    cancel: useCallback(async () => {
      await syncEngine.stop();
      setState(prev => ({
        ...prev,
        status: SyncDisplayStatus.IDLE,
        progress: null
      }));
    }, [syncEngine]),
    
    dismiss: useCallback((notificationId: string) => {
      dismissNotification(notificationId);
    }, [dismissNotification]),
    
    toggle: useCallback(() => {
      setState(prev => ({
        ...prev,
        isVisible: !prev.isVisible
      }));
    }, []),
    
    expand: useCallback(() => {
      setState(prev => ({
        ...prev,
        isExpanded: true
      }));
    }, []),
    
    collapse: useCallback(() => {
      setState(prev => ({
        ...prev,
        isExpanded: false
      }));
    }, [])
  };
  
  return [state, controls];
}
