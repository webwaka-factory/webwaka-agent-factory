# WebWaka Sync Conflict Resolution Strategy

**Version:** 1.0  
**Last Updated:** February 1, 2026  
**Issue:** #45 (SYNC-003)

---

## Table of Contents

1. [Overview](#overview)
2. [Conflict Types](#conflict-types)
3. [Resolution Strategies](#resolution-strategies)
4. [Conflict Detection](#conflict-detection)
5. [Deterministic Resolution](#deterministic-resolution)
6. [Manual Resolution](#manual-resolution)
7. [Data Preservation](#data-preservation)
8. [Conflict Logging](#conflict-logging)
9. [Implementation Guide](#implementation-guide)
10. [API Specification](#api-specification)

---

## Overview

WebWaka's offline-first architecture requires a robust conflict resolution strategy to handle situations where the same data is modified both offline and online. This specification defines how conflicts are detected, resolved, and logged while ensuring **no data loss**.

### Core Principles

1. **Never silently drop data** - Both versions are always preserved
2. **Deterministic by default** - Last-write-wins provides predictable outcomes
3. **User control when needed** - Manual resolution for important conflicts
4. **Transparent logging** - All conflicts are tracked and auditable
5. **Graceful degradation** - System remains functional during conflicts

---

## Conflict Types

### Type 1: Update-Update Conflict

**Description:** Same entity modified offline and online.

**Example:**
```
Timeline:
1. User goes offline
2. User updates Task A offline: title = "Offline Version"
3. Another user updates Task A online: title = "Online Version"
4. User goes online and syncs
5. CONFLICT: Two different versions of Task A
```

**Detection:**
- Entity has been modified locally (pending transaction in queue)
- Entity has been modified on server (server version > local version)
- Modifications are to the same entity

**Resolution Options:**
- Last-write-wins (default)
- Manual resolution
- Merge (if possible)

---

### Type 2: Delete-Update Conflict

**Description:** Entity deleted offline but updated online (or vice versa).

**Example:**
```
Timeline:
1. User goes offline
2. User deletes Task A offline
3. Another user updates Task A online: priority = "high"
4. User goes online and syncs
5. CONFLICT: Task A deleted locally but updated on server
```

**Detection:**
- Entity has been deleted locally (delete transaction in queue)
- Entity has been updated on server (server version > local version)

**Resolution Options:**
- Keep deletion (default if deleted most recently)
- Keep update (restore entity with server changes)
- Manual resolution

---

### Type 3: Create-Create Conflict (Duplicate)

**Description:** Same entity created on multiple devices with different temp IDs.

**Example:**
```
Timeline:
1. User A goes offline and creates Task "Buy milk"
2. User B goes offline and creates Task "Buy milk"
3. Both sync
4. CONFLICT: Two tasks with same title, different IDs
```

**Detection:**
- Multiple entities with similar attributes (title, timestamp)
- Different IDs (temp IDs not yet resolved)

**Resolution Options:**
- Keep both (default - user can merge manually later)
- Deduplicate (if entities are identical)
- Manual resolution

---

### Type 4: Merge-Capable Conflict

**Description:** Conflict where both changes can be merged without loss.

**Example:**
```
Timeline:
1. User goes offline
2. User updates Task A offline: description = "New description"
3. Another user updates Task A online: priority = "high"
4. User goes online and syncs
5. MERGEABLE: Different fields modified, can merge
```

**Detection:**
- Entity modified both locally and on server
- Modifications are to different fields (no overlapping changes)

**Resolution Options:**
- Automatic merge (default)
- Manual resolution (if user prefers)

---

## Resolution Strategies

### Strategy 1: Last-Write-Wins (LWW)

**Description:** The most recent modification wins, determined by timestamp.

**When to Use:**
- Default strategy for all conflicts
- When deterministic outcome is required
- When user doesn't want to be interrupted

**How It Works:**
```typescript
function lastWriteWins(local: Entity, server: Entity): Entity {
  if (local.timestamp > server.timestamp) {
    return local; // Local version is newer
  } else {
    return server; // Server version is newer
  }
}
```

**Pros:**
- ✅ Deterministic and predictable
- ✅ No user intervention required
- ✅ Fast resolution

**Cons:**
- ⚠️ May lose data if timestamps are close
- ⚠️ Doesn't account for user intent

---

### Strategy 2: Manual Resolution

**Description:** Surface conflict to user and let them choose.

**When to Use:**
- Important entities (e.g., orders, financial data)
- User has enabled "manual resolution" in settings
- Automatic resolution fails

**How It Works:**
```typescript
async function manualResolution(
  local: Entity,
  server: Entity
): Promise<Entity> {
  // Show conflict UI to user
  const choice = await showConflictDialog({
    local,
    server,
    options: ['keep_local', 'keep_server', 'merge', 'review']
  });
  
  switch (choice) {
    case 'keep_local':
      return local;
    case 'keep_server':
      return server;
    case 'merge':
      return await attemptMerge(local, server);
    case 'review':
      return await showDetailedReview(local, server);
  }
}
```

**Pros:**
- ✅ User has full control
- ✅ No data loss
- ✅ Accounts for user intent

**Cons:**
- ⚠️ Requires user intervention
- ⚠️ Can interrupt workflow
- ⚠️ May accumulate if user ignores conflicts

---

### Strategy 3: Automatic Merge

**Description:** Automatically merge non-overlapping changes.

**When to Use:**
- Merge-capable conflicts (different fields modified)
- Changes don't conflict semantically
- Both versions have valuable data

**How It Works:**
```typescript
function automaticMerge(local: Entity, server: Entity): Entity {
  const merged = { ...server }; // Start with server version
  
  // Identify fields changed locally
  const localChanges = getChangedFields(local, original);
  
  // Identify fields changed on server
  const serverChanges = getChangedFields(server, original);
  
  // Check for overlapping changes
  const overlapping = localChanges.filter(f => serverChanges.includes(f));
  
  if (overlapping.length > 0) {
    // Cannot auto-merge, fall back to LWW or manual
    return lastWriteWins(local, server);
  }
  
  // Merge non-overlapping changes
  for (const field of localChanges) {
    merged[field] = local[field];
  }
  
  return merged;
}
```

**Pros:**
- ✅ Preserves all changes
- ✅ No user intervention
- ✅ Best of both worlds

**Cons:**
- ⚠️ Only works for non-overlapping changes
- ⚠️ May produce semantically incorrect results
- ⚠️ Requires tracking original version

---

### Strategy 4: First-Write-Wins (FWW)

**Description:** The first modification wins, subsequent changes are rejected.

**When to Use:**
- Rarely used (not recommended)
- Legacy systems that require it
- Specific business rules

**How It Works:**
```typescript
function firstWriteWins(local: Entity, server: Entity): Entity {
  if (local.timestamp < server.timestamp) {
    return local; // Local version is older (first)
  } else {
    return server; // Server version is older (first)
  }
}
```

**Pros:**
- ✅ Deterministic

**Cons:**
- ⚠️ Counter-intuitive
- ⚠️ May lose recent important changes
- ⚠️ Not recommended for offline-first

---

## Conflict Detection

### Metadata Requirements

Each entity must have the following metadata for conflict detection:

```typescript
interface EntityMetadata {
  id: string;              // Entity ID (UUID or server ID)
  version: number;         // Version number (incremented on each change)
  timestamp: number;       // Last modified timestamp (Unix milliseconds)
  deviceId: string;        // Device that made the change
  userId: string;          // User who made the change
  vectorClock?: VectorClock; // Optional: for advanced conflict detection
}

interface VectorClock {
  [deviceId: string]: number;
}
```

### Detection Algorithm

```typescript
function detectConflict(
  local: Entity,
  server: Entity
): Conflict | null {
  // No conflict if versions match
  if (local.version === server.version) {
    return null;
  }
  
  // No conflict if local is ahead (not yet synced)
  if (local.version > server.version && !hasPendingSync(local)) {
    return null;
  }
  
  // No conflict if server is ahead (just needs to pull)
  if (server.version > local.version && !hasPendingSync(local)) {
    return null;
  }
  
  // CONFLICT: Both have been modified
  if (hasPendingSync(local) && server.version > local.baseVersion) {
    return {
      type: determineConflictType(local, server),
      local,
      server,
      detectedAt: Date.now()
    };
  }
  
  return null;
}
```

### Vector Clock Detection (Advanced)

```typescript
function detectConflictWithVectorClock(
  local: Entity,
  server: Entity
): Conflict | null {
  const comparison = compareVectorClocks(
    local.vectorClock,
    server.vectorClock
  );
  
  switch (comparison) {
    case 'EQUAL':
      return null; // No conflict
    
    case 'GREATER':
      return null; // Local is ahead (not yet synced)
    
    case 'LESS':
      return null; // Server is ahead (just needs to pull)
    
    case 'CONCURRENT':
      // CONFLICT: Both have been modified concurrently
      return {
        type: determineConflictType(local, server),
        local,
        server,
        detectedAt: Date.now()
      };
  }
}
```

---

## Deterministic Resolution

### Last-Write-Wins Implementation

```typescript
class ConflictResolver {
  async resolveConflict(conflict: Conflict): Promise<Resolution> {
    // Get resolution strategy (from settings or default)
    const strategy = await this.getResolutionStrategy(conflict);
    
    switch (strategy) {
      case 'last-write-wins':
        return this.lastWriteWins(conflict);
      
      case 'manual':
        return this.manualResolution(conflict);
      
      case 'auto-merge':
        return this.automaticMerge(conflict);
      
      default:
        return this.lastWriteWins(conflict); // Default fallback
    }
  }
  
  private lastWriteWins(conflict: Conflict): Resolution {
    const { local, server } = conflict;
    
    // Compare timestamps
    const winner = local.timestamp > server.timestamp ? local : server;
    const loser = winner === local ? server : local;
    
    // Log conflict
    this.logConflict(conflict, 'last-write-wins', winner);
    
    // Preserve loser version
    this.preserveVersion(loser, 'conflict_loser');
    
    return {
      strategy: 'last-write-wins',
      resolution: winner,
      preservedVersions: [loser]
    };
  }
}
```

### Timestamp Comparison

```typescript
function compareTimestamps(
  timestamp1: number,
  timestamp2: number,
  tolerance: number = 1000 // 1 second tolerance
): 'GREATER' | 'LESS' | 'EQUAL' {
  const diff = timestamp1 - timestamp2;
  
  if (Math.abs(diff) < tolerance) {
    return 'EQUAL'; // Within tolerance, consider equal
  }
  
  return diff > 0 ? 'GREATER' : 'LESS';
}
```

---

## Manual Resolution

### Conflict UI

```typescript
interface ConflictDialogProps {
  conflict: Conflict;
  onResolve: (resolution: Resolution) => void;
}

function ConflictDialog({ conflict, onResolve }: ConflictDialogProps) {
  const { local, server } = conflict;
  
  return (
    <Dialog title="Conflict Detected">
      <p>This {conflict.entityType} was modified both offline and online.</p>
      
      <ComparisonView>
        <Version label="Your Version (Offline)" data={local} />
        <Version label="Server Version (Online)" data={server} />
      </ComparisonView>
      
      <Actions>
        <Button onClick={() => onResolve(keepLocal(local))}>
          Keep My Version
        </Button>
        <Button onClick={() => onResolve(keepServer(server))}>
          Keep Server Version
        </Button>
        <Button onClick={() => onResolve(merge(local, server))}>
          Merge Both
        </Button>
        <Button onClick={() => onResolve(reviewLater(conflict))}>
          Review Later
        </Button>
      </Actions>
    </Dialog>
  );
}
```

### Batch Conflict Resolution

```typescript
async function resolveBatchConflicts(
  conflicts: Conflict[]
): Promise<Resolution[]> {
  // Group conflicts by entity type
  const grouped = groupBy(conflicts, c => c.entityType);
  
  const resolutions: Resolution[] = [];
  
  for (const [entityType, entityConflicts] of Object.entries(grouped)) {
    // Show batch resolution UI
    const batchChoice = await showBatchResolutionDialog({
      entityType,
      count: entityConflicts.length,
      options: [
        'resolve_all_lww',
        'resolve_all_keep_local',
        'resolve_all_keep_server',
        'review_individually'
      ]
    });
    
    if (batchChoice === 'review_individually') {
      // Resolve one by one
      for (const conflict of entityConflicts) {
        const resolution = await manualResolution(conflict);
        resolutions.push(resolution);
      }
    } else {
      // Apply batch strategy
      for (const conflict of entityConflicts) {
        const resolution = applyBatchStrategy(conflict, batchChoice);
        resolutions.push(resolution);
      }
    }
  }
  
  return resolutions;
}
```

---

## Data Preservation

### Conflict Archive

All conflict versions are preserved in a conflict archive:

```typescript
interface ConflictArchive {
  conflictId: string;
  entityType: string;
  entityId: string;
  detectedAt: number;
  resolvedAt: number;
  strategy: string;
  versions: {
    local: Entity;
    server: Entity;
    resolution: Entity;
  };
  metadata: {
    deviceId: string;
    userId: string;
    networkCondition: string;
  };
}

async function preserveConflict(
  conflict: Conflict,
  resolution: Resolution
): Promise<void> {
  const archive: ConflictArchive = {
    conflictId: generateUUID(),
    entityType: conflict.entityType,
    entityId: conflict.entityId,
    detectedAt: conflict.detectedAt,
    resolvedAt: Date.now(),
    strategy: resolution.strategy,
    versions: {
      local: conflict.local,
      server: conflict.server,
      resolution: resolution.resolution
    },
    metadata: {
      deviceId: getDeviceId(),
      userId: getUserId(),
      networkCondition: getNetworkCondition()
    }
  };
  
  // Save to conflict archive (local + server)
  await localStore.save('conflict_archive', archive);
  await api.saveConflictArchive(archive);
}
```

### Version History

```typescript
interface VersionHistory {
  entityId: string;
  versions: EntityVersion[];
}

interface EntityVersion {
  version: number;
  timestamp: number;
  data: Entity;
  source: 'local' | 'server' | 'merge';
  conflictId?: string;
}

async function getVersionHistory(entityId: string): Promise<VersionHistory> {
  const versions = await localStore.getVersionHistory(entityId);
  return {
    entityId,
    versions: versions.sort((a, b) => a.version - b.version)
  };
}
```

---

## Conflict Logging

### Log Structure

```typescript
interface ConflictLog {
  timestamp: number;
  conflictId: string;
  entityType: string;
  entityId: string;
  conflictType: ConflictType;
  strategy: ResolutionStrategy;
  outcome: 'resolved' | 'pending' | 'failed';
  duration: number; // Time to resolve (ms)
  metadata: {
    deviceId: string;
    userId: string;
    appVersion: string;
    networkCondition: string;
  };
}
```

### Logging Implementation

```typescript
class ConflictLogger {
  async logConflict(
    conflict: Conflict,
    strategy: string,
    outcome: Entity
  ): Promise<void> {
    const log: ConflictLog = {
      timestamp: Date.now(),
      conflictId: conflict.id,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      conflictType: conflict.type,
      strategy,
      outcome: 'resolved',
      duration: Date.now() - conflict.detectedAt,
      metadata: {
        deviceId: getDeviceId(),
        userId: getUserId(),
        appVersion: getAppVersion(),
        networkCondition: getNetworkCondition()
      }
    };
    
    // Save to local log
    await localStore.save('conflict_log', log);
    
    // Send to analytics (when online)
    await analytics.track('conflict_resolved', log);
  }
  
  async getConflictStats(): Promise<ConflictStats> {
    const logs = await localStore.list('conflict_log');
    
    return {
      total: logs.length,
      byType: countBy(logs, 'conflictType'),
      byStrategy: countBy(logs, 'strategy'),
      byOutcome: countBy(logs, 'outcome'),
      avgDuration: average(logs.map(l => l.duration))
    };
  }
}
```

---

## Implementation Guide

### Step 1: Add Metadata to Entities

```typescript
// Before
interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
}

// After
interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  
  // Conflict resolution metadata
  version: number;
  timestamp: number;
  deviceId: string;
  userId: string;
}
```

### Step 2: Detect Conflicts During Sync

```typescript
async function syncEntity(entity: Entity): Promise<void> {
  try {
    // Attempt to sync
    const serverEntity = await api.updateEntity(entity);
    
    // Update local with server response
    await localStore.save(entity.type, serverEntity);
    
  } catch (error) {
    if (error.code === 'CONFLICT') {
      // Conflict detected
      const conflict: Conflict = {
        id: generateUUID(),
        entityType: entity.type,
        entityId: entity.id,
        type: error.conflictType,
        local: entity,
        server: error.serverVersion,
        detectedAt: Date.now()
      };
      
      // Resolve conflict
      const resolution = await conflictResolver.resolveConflict(conflict);
      
      // Apply resolution
      await applyResolution(resolution);
      
      // Log conflict
      await conflictLogger.logConflict(conflict, resolution.strategy, resolution.resolution);
    } else {
      throw error;
    }
  }
}
```

### Step 3: Implement Resolution Strategies

```typescript
class ConflictResolver {
  private strategies: Map<string, ResolutionStrategy>;
  
  constructor() {
    this.strategies = new Map([
      ['last-write-wins', this.lastWriteWins.bind(this)],
      ['manual', this.manualResolution.bind(this)],
      ['auto-merge', this.automaticMerge.bind(this)],
      ['first-write-wins', this.firstWriteWins.bind(this)]
    ]);
  }
  
  async resolveConflict(conflict: Conflict): Promise<Resolution> {
    const strategyName = await this.getStrategyForConflict(conflict);
    const strategy = this.strategies.get(strategyName);
    
    if (!strategy) {
      throw new Error(`Unknown strategy: ${strategyName}`);
    }
    
    return await strategy(conflict);
  }
}
```

### Step 4: Preserve All Versions

```typescript
async function applyResolution(resolution: Resolution): Promise<void> {
  // Save resolved version
  await localStore.save(resolution.entityType, resolution.resolution);
  
  // Preserve all versions in conflict archive
  await preserveConflict(resolution.conflict, resolution);
  
  // Update version history
  await addToVersionHistory(resolution.resolution);
  
  // Sync resolution to server
  await api.applyResolution(resolution);
}
```

---

## API Specification

### Client → Server

#### Sync Entity with Conflict Detection

```http
PUT /api/v1/entities/{type}/{id}
Content-Type: application/json

{
  "data": { ... },
  "metadata": {
    "version": 5,
    "timestamp": 1706745600000,
    "deviceId": "device-123",
    "userId": "user-456"
  }
}
```

**Response (Success):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": { ... },
  "metadata": {
    "version": 6,
    "timestamp": 1706745601000,
    "deviceId": "device-123",
    "userId": "user-456"
  }
}
```

**Response (Conflict):**
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "error": "CONFLICT",
  "conflictType": "update-update",
  "serverVersion": {
    "data": { ... },
    "metadata": {
      "version": 6,
      "timestamp": 1706745599000,
      "deviceId": "device-789",
      "userId": "user-012"
    }
  }
}
```

#### Apply Conflict Resolution

```http
POST /api/v1/conflicts/resolve
Content-Type: application/json

{
  "conflictId": "conflict-123",
  "entityType": "task",
  "entityId": "task-456",
  "strategy": "last-write-wins",
  "resolution": {
    "data": { ... },
    "metadata": { ... }
  }
}
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "resolved",
  "entity": {
    "data": { ... },
    "metadata": { ... }
  }
}
```

---

## Conclusion

WebWaka's conflict resolution strategy ensures that:

1. ✅ **No data is ever lost** - All versions are preserved
2. ✅ **Conflicts are resolved deterministically** - Last-write-wins by default
3. ✅ **Users have control** - Manual resolution when needed
4. ✅ **All conflicts are logged** - Full auditability
5. ✅ **System remains functional** - Graceful degradation during conflicts

This strategy aligns with the offline-first architecture and ensures a reliable, predictable user experience.

---

**Document Version:** 1.0  
**Last Updated:** February 1, 2026  
**Maintained By:** WebWaka Platform Team
