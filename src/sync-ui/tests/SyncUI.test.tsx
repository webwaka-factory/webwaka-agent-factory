/**
 * SYNC-004 — Sync UI Comprehensive Tests
 * 
 * @module SyncUI.test
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-hooks';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSyncUI } from '../hooks/useSyncUI';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { ISyncEngine, SyncEventType, SyncStatus } from '../../sync-engine/interfaces/SyncEngine';

// Mock sync engine
const mockSyncEngine: jest.Mocked<ISyncEngine> = {
  initialize: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  sync: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getStatus: jest.fn(),
  getProgress: jest.fn(),
  getStats: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  isInitialized: jest.fn().mockReturnValue(true),
  isSyncing: jest.fn(),
  close: jest.fn()
} as any;

describe('Sync UI - useSyncUI Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useSyncUI(mockSyncEngine));
    const [state] = result.current;
    
    expect(state.status).toBe('idle');
    expect(state.progress).toBeNull();
    expect(state.isVisible).toBe(true);
    expect(state.isExpanded).toBe(false);
  });
  
  it('should register event listeners on mount', () => {
    renderHook(() => useSyncUI(mockSyncEngine));
    
    expect(mockSyncEngine.on).toHaveBeenCalledWith(
      SyncEventType.SYNC_STARTED,
      expect.any(Function)
    );
    expect(mockSyncEngine.on).toHaveBeenCalledWith(
      SyncEventType.SYNC_PROGRESS,
      expect.any(Function)
    );
  });
  
  it('should provide pause control', async () => {
    const { result } = renderHook(() => useSyncUI(mockSyncEngine));
    const [, controls] = result.current;
    
    await act(async () => {
      await controls.pause();
    });
    
    expect(mockSyncEngine.pause).toHaveBeenCalled();
  });
  
  it('should provide resume control', async () => {
    const { result } = renderHook(() => useSyncUI(mockSyncEngine));
    const [, controls] = result.current;
    
    await act(async () => {
      await controls.resume();
    });
    
    expect(mockSyncEngine.resume).toHaveBeenCalled();
  });
  
  it('should toggle visibility', () => {
    const { result } = renderHook(() => useSyncUI(mockSyncEngine));
    
    act(() => {
      result.current[1].toggle();
    });
    
    expect(result.current[0].isVisible).toBe(false);
  });
});

describe('Sync UI - SyncStatusBar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncEngine.getStats.mockReturnValue({
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalTransactionsSynced: 0,
      totalTransactionsFailed: 0,
      totalConflicts: 0,
      avgSyncDuration: 0,
      lastSyncTime: null,
      lastSyncSuccess: false
    });
  });
  
  it('should render status bar', () => {
    render(<SyncStatusBar syncEngine={mockSyncEngine} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });
  
  it('should display syncing status', () => {
    mockSyncEngine.getStatus.mockReturnValue(SyncStatus.SYNCING);
    render(<SyncStatusBar syncEngine={mockSyncEngine} />);
    expect(screen.getByText('Syncing...')).toBeInTheDocument();
  });
  
  it('should show progress when available', () => {
    mockSyncEngine.getProgress.mockReturnValue({
      currentBatch: 1,
      totalBatches: 2,
      currentTransaction: 50,
      totalTransactions: 100,
      syncedCount: 50,
      failedCount: 0,
      conflictCount: 0,
      percentComplete: 50,
      estimatedTimeRemaining: null
    });
    
    render(<SyncStatusBar syncEngine={mockSyncEngine} />);
    expect(screen.getByText(/50 of 100 transactions/)).toBeInTheDocument();
  });
  
  it('should render pause button when syncing', () => {
    mockSyncEngine.getStatus.mockReturnValue(SyncStatus.SYNCING);
    render(<SyncStatusBar syncEngine={mockSyncEngine} />);
    
    const pauseButton = screen.getByTitle('Pause sync');
    expect(pauseButton).toBeInTheDocument();
  });
  
  it('should call pause when pause button clicked', () => {
    mockSyncEngine.getStatus.mockReturnValue(SyncStatus.SYNCING);
    render(<SyncStatusBar syncEngine={mockSyncEngine} />);
    
    const pauseButton = screen.getByTitle('Pause sync');
    fireEvent.click(pauseButton);
    
    expect(mockSyncEngine.pause).toHaveBeenCalled();
  });
});

// Additional tests would cover:
// - Error display
// - Notifications
// - Expand/collapse
// - Retry functionality
// - Stats display
