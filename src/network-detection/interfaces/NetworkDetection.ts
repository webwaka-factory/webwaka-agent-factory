/**
 * SYNC-001 — Network Reconnect Detection
 * 
 * Interface for reliable network reconnection detection.
 * Combines navigator.onLine with active ping checks.
 * 
 * @module NetworkDetection
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

/**
 * Network connection state
 */
export enum NetworkState {
  /** Confirmed online (connectivity verified) */
  ONLINE = 'online',
  
  /** Confirmed offline (no connectivity) */
  OFFLINE = 'offline',
  
  /** Transitioning between states (debouncing) */
  TRANSITIONING = 'transitioning'
}

/**
 * Network event type
 */
export enum NetworkEventType {
  /** Network became online */
  ONLINE = 'online',
  
  /** Network became offline */
  OFFLINE = 'offline',
  
  /** Network state is transitioning */
  TRANSITIONING = 'transitioning'
}

/**
 * Network event
 */
export interface NetworkEvent {
  /** Event type */
  type: NetworkEventType;
  
  /** Previous state */
  previousState: NetworkState;
  
  /** Current state */
  currentState: NetworkState;
  
  /** Timestamp (ISO 8601) */
  timestamp: string;
  
  /** Additional event data */
  data?: any;
}

/**
 * Network detection configuration
 */
export interface NetworkDetectionConfig {
  /** Health check endpoint URL */
  healthEndpoint: string;
  
  /** Debounce duration in milliseconds (default: 2000) */
  debounceDuration?: number;
  
  /** Number of retry attempts for ping (default: 3) */
  retryAttempts?: number;
  
  /** Backoff duration between retries in milliseconds (default: 500) */
  retryBackoff?: number;
  
  /** Ping timeout in milliseconds (default: 5000) */
  pingTimeout?: number;
  
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Network detection statistics
 */
export interface NetworkDetectionStats {
  /** Current network state */
  currentState: NetworkState;
  
  /** Timestamp of last state change */
  lastStateChange: string | null;
  
  /** Total number of state changes */
  stateChangeCount: number;
  
  /** Total number of online events */
  onlineEventCount: number;
  
  /** Total number of offline events */
  offlineEventCount: number;
  
  /** Total number of ping attempts */
  pingAttemptCount: number;
  
  /** Total number of successful pings */
  pingSuccessCount: number;
  
  /** Total number of failed pings */
  pingFailureCount: number;
  
  /** Average ping latency in milliseconds */
  avgPingLatency: number;
  
  /** Last ping latency in milliseconds */
  lastPingLatency: number | null;
  
  /** Last ping timestamp */
  lastPingTimestamp: string | null;
  
  /** Uptime percentage (0-100) */
  uptimePercentage: number;
}

/**
 * Network event listener
 */
export type NetworkEventListener = (event: NetworkEvent) => void;

/**
 * Core network detection interface
 */
export interface INetworkDetection {
  /**
   * Initialize network detection
   * 
   * @param config - Network detection configuration
   * @throws {NetworkDetectionError} If initialization fails
   */
  initialize(config: NetworkDetectionConfig): Promise<void>;
  
  /**
   * Start monitoring network state
   * 
   * @throws {NetworkDetectionError} If not initialized or start fails
   */
  start(): Promise<void>;
  
  /**
   * Stop monitoring network state
   * 
   * @throws {NetworkDetectionError} If stop fails
   */
  stop(): Promise<void>;
  
  /**
   * Get current network state
   * 
   * @returns Current network state
   * @throws {NetworkDetectionError} If not initialized
   */
  getState(): NetworkState;
  
  /**
   * Check if currently online
   * 
   * @returns True if online
   * @throws {NetworkDetectionError} If not initialized
   */
  isOnline(): boolean;
  
  /**
   * Check if currently offline
   * 
   * @returns True if offline
   * @throws {NetworkDetectionError} If not initialized
   */
  isOffline(): boolean;
  
  /**
   * Manually trigger a network check (ping)
   * 
   * @returns True if online, false if offline
   * @throws {NetworkDetectionError} If ping fails
   */
  checkConnectivity(): Promise<boolean>;
  
  /**
   * Add event listener
   * 
   * @param eventType - Event type to listen for
   * @param listener - Event listener function
   */
  on(eventType: NetworkEventType, listener: NetworkEventListener): void;
  
  /**
   * Remove event listener
   * 
   * @param eventType - Event type
   * @param listener - Event listener function
   */
  off(eventType: NetworkEventType, listener: NetworkEventListener): void;
  
  /**
   * Get network detection statistics
   * 
   * @returns Network statistics
   * @throws {NetworkDetectionError} If not initialized
   */
  getStats(): NetworkDetectionStats;
  
  /**
   * Check if detection is initialized
   * 
   * @returns True if initialized
   */
  isInitialized(): boolean;
  
  /**
   * Check if monitoring is active
   * 
   * @returns True if monitoring
   */
  isMonitoring(): boolean;
  
  /**
   * Close detection and release resources
   * 
   * @throws {NetworkDetectionError} If close fails
   */
  close(): Promise<void>;
}

/**
 * Custom error class for network detection operations
 */
export class NetworkDetectionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'NetworkDetectionError';
  }
}

/**
 * Network detection error codes
 */
export enum NetworkDetectionErrorCode {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  START_FAILED = 'START_FAILED',
  STOP_FAILED = 'STOP_FAILED',
  PING_FAILED = 'PING_FAILED',
  INVALID_CONFIG = 'INVALID_CONFIG',
  PLATFORM_NOT_SUPPORTED = 'PLATFORM_NOT_SUPPORTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
