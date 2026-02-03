/**
 * TXQ-003 — Conflict Detection Metadata Interfaces
 * 
 * @module ConflictMetadata
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

/**
 * Conflict detection metadata for transactions
 */
export interface ConflictMetadata {
  /** Transaction version (increments on modification) */
  version: number;
  
  /** Server timestamp (ISO 8601) */
  serverTimestamp: string | null;
  
  /** Device timestamp (ISO 8601) */
  deviceTimestamp: string;
  
  /** Content hash (SHA-256) */
  contentHash: string;
  
  /** User ID who created/modified */
  userId: string;
  
  /** Device ID where created/modified */
  deviceId: string;
  
  /** Parent transaction IDs (causality tracking) */
  parentIds: string[];
  
  /** Last modified timestamp */
  lastModified: string;
  
  /** Creation timestamp */
  createdAt: string;
}

/**
 * Metadata tracker interface
 */
export interface IConflictMetadataTracker {
  /**
   * Generate metadata for new transaction
   */
  generateMetadata(
    transactionId: string,
    payload: any,
    userId: string,
    deviceId: string,
    parentIds?: string[]
  ): Promise<ConflictMetadata>;
  
  /**
   * Update metadata on modification
   */
  updateMetadata(
    currentMetadata: ConflictMetadata,
    newPayload: any
  ): Promise<ConflictMetadata>;
  
  /**
   * Compute content hash
   */
  computeHash(content: any): Promise<string>;
  
  /**
   * Validate metadata
   */
  validateMetadata(metadata: ConflictMetadata): boolean;
  
  /**
   * Compare metadata for conflicts
   */
  detectConflict(
    local: ConflictMetadata,
    remote: ConflictMetadata
  ): ConflictDetectionResult;
}

/**
 * Conflict detection result
 */
export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflictType: ConflictType | null;
  reason: string | null;
  localVersion: number;
  remoteVersion: number;
  resolution: ConflictResolution | null;
}

/**
 * Types of conflicts
 */
export enum ConflictType {
  VERSION_MISMATCH = 'version_mismatch',
  TIMESTAMP_CONFLICT = 'timestamp_conflict',
  HASH_MISMATCH = 'hash_mismatch',
  CAUSALITY_VIOLATION = 'causality_violation',
  CONCURRENT_MODIFICATION = 'concurrent_modification'
}

/**
 * Conflict resolution strategies
 */
export enum ConflictResolution {
  USE_LOCAL = 'use_local',
  USE_REMOTE = 'use_remote',
  MERGE = 'merge',
  MANUAL = 'manual',
  LAST_WRITE_WINS = 'last_write_wins'
}

/**
 * Metadata validation error
 */
export class MetadataValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'MetadataValidationError';
  }
}
