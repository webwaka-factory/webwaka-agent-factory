/**
 * SYNC-001 — Network Reconnect Detection Implementation
 * 
 * Reliable network detection combining navigator.onLine with active ping checks.
 * Implements state machine with debouncing to avoid false positives.
 * 
 * @module NetworkDetector
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import {
  INetworkDetection,
  NetworkState,
  NetworkEvent,
  NetworkEventType,
  NetworkEventListener,
  NetworkDetectionConfig,
  NetworkDetectionStats,
  NetworkDetectionError,
  NetworkDetectionErrorCode
} from '../interfaces/NetworkDetection';

/**
 * Network detector implementation
 */
export class NetworkDetector implements INetworkDetection {
  private config: NetworkDetectionConfig | null = null;
  private initialized: boolean = false;
  private monitoring: boolean = false;
  private currentState: NetworkState = NetworkState.OFFLINE;
  private previousState: NetworkState = NetworkState.OFFLINE;
  
  // Event listeners
  private listeners: Map<NetworkEventType, Set<NetworkEventListener>> = new Map();
  
  // Debouncing
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingState: NetworkState | null = null;
  
  // Platform event handlers
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;
  
  // Statistics
  private stats = {
    lastStateChange: null as string | null,
    stateChangeCount: 0,
    onlineEventCount: 0,
    offlineEventCount: 0,
    pingAttemptCount: 0,
    pingSuccessCount: 0,
    pingFailureCount: 0,
    pingLatencies: [] as number[],
    lastPingLatency: null as number | null,
    lastPingTimestamp: null as string | null,
    onlineTime: 0,
    offlineTime: 0,
    lastTransitionTime: Date.now()
  };
  
  /**
   * Initialize network detection
   */
  async initialize(config: NetworkDetectionConfig): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      // Validate config
      if (!config.healthEndpoint) {
        throw new NetworkDetectionError(
          'Health endpoint is required',
          NetworkDetectionErrorCode.INVALID_CONFIG
        );
      }
      
      this.config = {
        ...config,
        debounceDuration: config.debounceDuration || 2000,
        retryAttempts: config.retryAttempts || 3,
        retryBackoff: config.retryBackoff || 500,
        pingTimeout: config.pingTimeout || 5000,
        debug: config.debug || false
      };
      
      // Initialize event listener maps
      this.listeners.set(NetworkEventType.ONLINE, new Set());
      this.listeners.set(NetworkEventType.OFFLINE, new Set());
      this.listeners.set(NetworkEventType.TRANSITIONING, new Set());
      
      // Detect initial state
      const isOnline = await this.checkConnectivity();
      this.currentState = isOnline ? NetworkState.ONLINE : NetworkState.OFFLINE;
      this.previousState = this.currentState;
      
      this.initialized = true;
      this.log('Network detection initialized');
    } catch (error) {
      throw new NetworkDetectionError(
        'Failed to initialize network detection',
        NetworkDetectionErrorCode.INITIALIZATION_FAILED,
        error
      );
    }
  }
  
  /**
   * Start monitoring network state
   */
  async start(): Promise<void> {
    this.ensureInitialized();
    
    if (this.monitoring) {
      return;
    }
    
    try {
      // Set up platform event listeners
      if (typeof window !== 'undefined' && window.addEventListener) {
        this.onlineHandler = () => this.handlePlatformEvent(NetworkState.ONLINE);
        this.offlineHandler = () => this.handlePlatformEvent(NetworkState.OFFLINE);
        
        window.addEventListener('online', this.onlineHandler);
        window.addEventListener('offline', this.offlineHandler);
      }
      
      this.monitoring = true;
      this.log('Network monitoring started');
    } catch (error) {
      throw new NetworkDetectionError(
        'Failed to start network monitoring',
        NetworkDetectionErrorCode.START_FAILED,
        error
      );
    }
  }
  
  /**
   * Stop monitoring network state
   */
  async stop(): Promise<void> {
    if (!this.monitoring) {
      return;
    }
    
    try {
      // Remove platform event listeners
      if (typeof window !== 'undefined' && window.removeEventListener) {
        if (this.onlineHandler) {
          window.removeEventListener('online', this.onlineHandler);
        }
        if (this.offlineHandler) {
          window.removeEventListener('offline', this.offlineHandler);
        }
      }
      
      // Clear debounce timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      
      this.monitoring = false;
      this.log('Network monitoring stopped');
    } catch (error) {
      throw new NetworkDetectionError(
        'Failed to stop network monitoring',
        NetworkDetectionErrorCode.STOP_FAILED,
        error
      );
    }
  }
  
  /**
   * Get current network state
   */
  getState(): NetworkState {
    this.ensureInitialized();
    return this.currentState;
  }
  
  /**
   * Check if currently online
   */
  isOnline(): boolean {
    this.ensureInitialized();
    return this.currentState === NetworkState.ONLINE;
  }
  
  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    this.ensureInitialized();
    return this.currentState === NetworkState.OFFLINE;
  }
  
  /**
   * Check connectivity with active ping
   */
  async checkConnectivity(): Promise<boolean> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    this.stats.pingAttemptCount++;
    
    try {
      // Try ping with retries
      for (let attempt = 0; attempt < this.config!.retryAttempts!; attempt++) {
        try {
          const pingStart = Date.now();
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.config!.pingTimeout!);
          
          const response = await fetch(this.config!.healthEndpoint, {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-cache'
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const latency = Date.now() - pingStart;
            this.stats.lastPingLatency = latency;
            this.stats.lastPingTimestamp = new Date().toISOString();
            this.stats.pingLatencies.push(latency);
            this.stats.pingSuccessCount++;
            
            this.log(`Ping successful (${latency}ms)`);
            return true;
          }
        } catch (error) {
          // Retry with backoff
          if (attempt < this.config!.retryAttempts! - 1) {
            await this.sleep(this.config!.retryBackoff! * (attempt + 1));
          }
        }
      }
      
      // All retries failed
      this.stats.pingFailureCount++;
      this.log('Ping failed after all retries');
      return false;
    } catch (error) {
      this.stats.pingFailureCount++;
      this.log(`Ping error: ${error}`);
      return false;
    }
  }
  
  /**
   * Add event listener
   */
  on(eventType: NetworkEventType, listener: NetworkEventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.add(listener);
    }
  }
  
  /**
   * Remove event listener
   */
  off(eventType: NetworkEventType, listener: NetworkEventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }
  
  /**
   * Get network detection statistics
   */
  getStats(): NetworkDetectionStats {
    this.ensureInitialized();
    
    // Update time tracking
    const now = Date.now();
    const elapsed = now - this.stats.lastTransitionTime;
    
    if (this.currentState === NetworkState.ONLINE) {
      this.stats.onlineTime += elapsed;
    } else if (this.currentState === NetworkState.OFFLINE) {
      this.stats.offlineTime += elapsed;
    }
    
    this.stats.lastTransitionTime = now;
    
    // Calculate average ping latency
    const avgPingLatency = this.stats.pingLatencies.length > 0
      ? this.stats.pingLatencies.reduce((sum, lat) => sum + lat, 0) / this.stats.pingLatencies.length
      : 0;
    
    // Calculate uptime percentage
    const totalTime = this.stats.onlineTime + this.stats.offlineTime;
    const uptimePercentage = totalTime > 0
      ? (this.stats.onlineTime / totalTime) * 100
      : 0;
    
    return {
      currentState: this.currentState,
      lastStateChange: this.stats.lastStateChange,
      stateChangeCount: this.stats.stateChangeCount,
      onlineEventCount: this.stats.onlineEventCount,
      offlineEventCount: this.stats.offlineEventCount,
      pingAttemptCount: this.stats.pingAttemptCount,
      pingSuccessCount: this.stats.pingSuccessCount,
      pingFailureCount: this.stats.pingFailureCount,
      avgPingLatency,
      lastPingLatency: this.stats.lastPingLatency,
      lastPingTimestamp: this.stats.lastPingTimestamp,
      uptimePercentage
    };
  }
  
  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Check if monitoring
   */
  isMonitoring(): boolean {
    return this.monitoring;
  }
  
  /**
   * Close detection
   */
  async close(): Promise<void> {
    await this.stop();
    this.initialized = false;
    this.config = null;
    this.listeners.clear();
    this.log('Network detection closed');
  }
  
  // Private helper methods
  
  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new NetworkDetectionError(
        'Network detection not initialized',
        NetworkDetectionErrorCode.NOT_INITIALIZED
      );
    }
  }
  
  private handlePlatformEvent(suggestedState: NetworkState): void {
    this.log(`Platform event: ${suggestedState}`);
    
    // Start debouncing
    this.startDebounce(suggestedState);
  }
  
  private startDebounce(targetState: NetworkState): void {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // Set pending state
    this.pendingState = targetState;
    
    // Transition to transitioning state
    if (this.currentState !== NetworkState.TRANSITIONING) {
      this.transitionToState(NetworkState.TRANSITIONING);
    }
    
    // Start debounce timer
    this.debounceTimer = setTimeout(async () => {
      await this.confirmStateChange();
    }, this.config!.debounceDuration!);
    
    this.log(`Debouncing to ${targetState} (${this.config!.debounceDuration}ms)`);
  }
  
  private async confirmStateChange(): Promise<void> {
    if (!this.pendingState) {
      return;
    }
    
    // Verify with active ping
    const isOnline = await this.checkConnectivity();
    const confirmedState = isOnline ? NetworkState.ONLINE : NetworkState.OFFLINE;
    
    // Only transition if confirmed state matches pending state
    if (confirmedState === this.pendingState) {
      this.transitionToState(confirmedState);
      this.log(`State confirmed: ${confirmedState}`);
    } else {
      this.log(`State mismatch: pending=${this.pendingState}, confirmed=${confirmedState}`);
      // Retry with confirmed state
      this.startDebounce(confirmedState);
    }
    
    this.pendingState = null;
  }
  
  private transitionToState(newState: NetworkState): void {
    if (this.currentState === newState) {
      return;
    }
    
    this.previousState = this.currentState;
    this.currentState = newState;
    
    // Update statistics
    const now = Date.now();
    const elapsed = now - this.stats.lastTransitionTime;
    
    if (this.previousState === NetworkState.ONLINE) {
      this.stats.onlineTime += elapsed;
    } else if (this.previousState === NetworkState.OFFLINE) {
      this.stats.offlineTime += elapsed;
    }
    
    this.stats.lastTransitionTime = now;
    this.stats.lastStateChange = new Date().toISOString();
    this.stats.stateChangeCount++;
    
    if (newState === NetworkState.ONLINE) {
      this.stats.onlineEventCount++;
    } else if (newState === NetworkState.OFFLINE) {
      this.stats.offlineEventCount++;
    }
    
    // Emit event
    this.emitEvent({
      type: this.stateToEventType(newState),
      previousState: this.previousState,
      currentState: this.currentState,
      timestamp: new Date().toISOString()
    });
    
    this.log(`State transition: ${this.previousState} -> ${this.currentState}`);
  }
  
  private stateToEventType(state: NetworkState): NetworkEventType {
    switch (state) {
      case NetworkState.ONLINE:
        return NetworkEventType.ONLINE;
      case NetworkState.OFFLINE:
        return NetworkEventType.OFFLINE;
      case NetworkState.TRANSITIONING:
        return NetworkEventType.TRANSITIONING;
      default:
        return NetworkEventType.OFFLINE;
    }
  }
  
  private emitEvent(event: NetworkEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          this.log(`Event listener error: ${error}`);
        }
      });
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private log(message: string): void {
    if (this.config?.debug) {
      console.log(`[NetworkDetector] ${message}`);
    }
  }
}
