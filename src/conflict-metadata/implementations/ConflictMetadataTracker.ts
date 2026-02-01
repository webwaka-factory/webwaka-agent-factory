/**
 * TXQ-003 — Conflict Metadata Tracker Implementation
 * 
 * @module ConflictMetadataTracker
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import {
  IConflictMetadataTracker,
  ConflictMetadata,
  ConflictDetectionResult,
  ConflictType,
  ConflictResolution,
  MetadataValidationError
} from '../interfaces/ConflictMetadata';
import { HashUtils } from '../utils/HashUtils';

export class ConflictMetadataTracker implements IConflictMetadataTracker {
  private hashUtils: HashUtils;
  
  constructor() {
    this.hashUtils = new HashUtils();
  }
  
  async generateMetadata(
    transactionId: string,
    payload: any,
    userId: string,
    deviceId: string,
    parentIds: string[] = []
  ): Promise<ConflictMetadata> {
    const now = new Date().toISOString();
    const contentHash = await this.computeHash(payload);
    
    return {
      version: 1,
      serverTimestamp: null, // Set by server on first sync
      deviceTimestamp: now,
      contentHash,
      userId,
      deviceId,
      parentIds,
      lastModified: now,
      createdAt: now
    };
  }
  
  async updateMetadata(
    currentMetadata: ConflictMetadata,
    newPayload: any
  ): Promise<ConflictMetadata> {
    const now = new Date().toISOString();
    const contentHash = await this.computeHash(newPayload);
    
    return {
      ...currentMetadata,
      version: currentMetadata.version + 1,
      deviceTimestamp: now,
      contentHash,
      lastModified: now
    };
  }
  
  async computeHash(content: any): Promise<string> {
    return this.hashUtils.sha256(JSON.stringify(content));
  }
  
  validateMetadata(metadata: ConflictMetadata): boolean {
    // Version must be positive
    if (metadata.version < 1) {
      throw new MetadataValidationError(
        'Version must be >= 1',
        'version'
      );
    }
    
    // Device timestamp required
    if (!metadata.deviceTimestamp) {
      throw new MetadataValidationError(
        'Device timestamp is required',
        'deviceTimestamp'
      );
    }
    
    // Content hash required (64 chars for SHA-256)
    if (!metadata.contentHash || metadata.contentHash.length !== 64) {
      throw new MetadataValidationError(
        'Valid SHA-256 content hash is required',
        'contentHash'
      );
    }
    
    // User ID required
    if (!metadata.userId) {
      throw new MetadataValidationError(
        'User ID is required',
        'userId'
      );
    }
    
    // Device ID required
    if (!metadata.deviceId) {
      throw new MetadataValidationError(
        'Device ID is required',
        'deviceId'
      );
    }
    
    // Timestamps must be valid ISO 8601
    try {
      new Date(metadata.deviceTimestamp);
      new Date(metadata.lastModified);
      new Date(metadata.createdAt);
      if (metadata.serverTimestamp) {
        new Date(metadata.serverTimestamp);
      }
    } catch (error) {
      throw new MetadataValidationError(
        'Invalid timestamp format',
        'timestamp'
      );
    }
    
    return true;
  }
  
  detectConflict(
    local: ConflictMetadata,
    remote: ConflictMetadata
  ): ConflictDetectionResult {
    // No conflict if versions match and hashes match
    if (local.version === remote.version && local.contentHash === remote.contentHash) {
      return {
        hasConflict: false,
        conflictType: null,
        reason: null,
        localVersion: local.version,
        remoteVersion: remote.version,
        resolution: null
      };
    }
    
    // Version mismatch conflict
    if (local.version !== remote.version) {
      return {
        hasConflict: true,
        conflictType: ConflictType.VERSION_MISMATCH,
        reason: `Version mismatch: local=${local.version}, remote=${remote.version}`,
        localVersion: local.version,
        remoteVersion: remote.version,
        resolution: this.resolveByTimestamp(local, remote)
      };
    }
    
    // Hash mismatch (same version, different content)
    if (local.contentHash !== remote.contentHash) {
      return {
        hasConflict: true,
        conflictType: ConflictType.HASH_MISMATCH,
        reason: 'Content hash mismatch with same version',
        localVersion: local.version,
        remoteVersion: remote.version,
        resolution: this.resolveByTimestamp(local, remote)
      };
    }
    
    // Causality violation check
    if (this.hasCausalityViolation(local, remote)) {
      return {
        hasConflict: true,
        conflictType: ConflictType.CAUSALITY_VIOLATION,
        reason: 'Causality violation detected',
        localVersion: local.version,
        remoteVersion: remote.version,
        resolution: ConflictResolution.MANUAL
      };
    }
    
    // Concurrent modification (different devices, similar timestamps)
    const timeDiff = Math.abs(
      new Date(local.lastModified).getTime() - 
      new Date(remote.lastModified).getTime()
    );
    
    if (timeDiff < 5000 && local.deviceId !== remote.deviceId) {
      return {
        hasConflict: true,
        conflictType: ConflictType.CONCURRENT_MODIFICATION,
        reason: 'Concurrent modification from different devices',
        localVersion: local.version,
        remoteVersion: remote.version,
        resolution: this.resolveByTimestamp(local, remote)
      };
    }
    
    // Default: no conflict
    return {
      hasConflict: false,
      conflictType: null,
      reason: null,
      localVersion: local.version,
      remoteVersion: remote.version,
      resolution: null
    };
  }
  
  private resolveByTimestamp(
    local: ConflictMetadata,
    remote: ConflictMetadata
  ): ConflictResolution {
    // Last-write-wins based on server timestamp (if available) or device timestamp
    const localTime = new Date(local.serverTimestamp || local.lastModified).getTime();
    const remoteTime = new Date(remote.serverTimestamp || remote.lastModified).getTime();
    
    if (localTime > remoteTime) {
      return ConflictResolution.USE_LOCAL;
    } else if (remoteTime > localTime) {
      return ConflictResolution.USE_REMOTE;
    } else {
      // Same timestamp, use device ID as tiebreaker
      return local.deviceId > remote.deviceId 
        ? ConflictResolution.USE_LOCAL 
        : ConflictResolution.USE_REMOTE;
    }
  }
  
  private hasCausalityViolation(
    local: ConflictMetadata,
    remote: ConflictMetadata
  ): boolean {
    // Check if local has remote as parent but remote is newer
    // This would indicate a causality violation
    // Simplified check: if remote version > local version but local has no parent reference
    if (remote.version > local.version && local.parentIds.length === 0) {
      return false; // Normal case
    }
    
    // More complex causality checks would go here
    // For now, return false (no violation)
    return false;
  }
}
