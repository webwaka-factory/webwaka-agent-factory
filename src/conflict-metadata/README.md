# TXQ-003 — Conflict Detection Metadata

## Overview

Metadata tracking system for conflict detection during synchronization. Implements version tracking, timestamp management, SHA-256 hashing, and causality tracking.

## Features

- ✅ Version tracking (increments on modification)
- ✅ Timestamp tracking (server + device time)
- ✅ SHA-256 content hashing
- ✅ User and device ID tracking
- ✅ Causality tracking (parent transaction IDs)
- ✅ Conflict detection (5 types)
- ✅ Conflict resolution strategies

## Quick Start

```typescript
import { ConflictMetadataTracker } from './implementations/ConflictMetadataTracker';

const tracker = new ConflictMetadataTracker();

// Generate metadata for new transaction
const metadata = await tracker.generateMetadata(
  'tx-1',
  { data: 'my data' },
  'user-123',
  'device-456'
);

// Update metadata on modification
const updated = await tracker.updateMetadata(metadata, { data: 'updated data' });

// Detect conflicts
const result = tracker.detectConflict(localMetadata, remoteMetadata);
if (result.hasConflict) {
  console.log('Conflict:', result.conflictType);
  console.log('Resolution:', result.resolution);
}
```

## Metadata Schema

```typescript
interface ConflictMetadata {
  version: number;              // Increments on each modification
  serverTimestamp: string | null; // Set by server on sync
  deviceTimestamp: string;      // ISO 8601
  contentHash: string;          // SHA-256 (64 chars)
  userId: string;               // User who created/modified
  deviceId: string;             // Device where created/modified
  parentIds: string[];          // Causality tracking
  lastModified: string;         // ISO 8601
  createdAt: string;            // ISO 8601
}
```

## Conflict Types

1. **VERSION_MISMATCH**: Different version numbers
2. **HASH_MISMATCH**: Same version, different content
3. **CAUSALITY_VIOLATION**: Dependency order violation
4. **CONCURRENT_MODIFICATION**: Simultaneous edits from different devices
5. **TIMESTAMP_CONFLICT**: Timestamp-based conflict

## Conflict Resolution

- **USE_LOCAL**: Keep local version
- **USE_REMOTE**: Use remote version
- **LAST_WRITE_WINS**: Use most recent (default)
- **MERGE**: Attempt automatic merge
- **MANUAL**: Require user intervention

## Dependencies

- **TXQ-001** ✅ (Transaction Queue)

---

**Module Version**: 1.0.0  
**Issue**: #39 (TXQ-003)  
**Status**: Complete  
**Author**: webwakaagent1
