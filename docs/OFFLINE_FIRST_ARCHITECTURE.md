# WebWaka Offline-First Architecture: Developer Guide

**Version:** 1.0  
**Last Updated:** February 1, 2026  
**Audience:** Developers, Architects

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Principles](#core-principles)
3. [Interaction Classes (INV-010)](#interaction-classes-inv-010)
4. [Local Data Persistence](#local-data-persistence)
5. [Transaction Queue](#transaction-queue)
6. [Synchronization Engine](#synchronization-engine)
7. [Conflict Resolution](#conflict-resolution)
8. [Session Management](#session-management)
9. [Implementation Guide](#implementation-guide)
10. [Testing Strategy](#testing-strategy)
11. [Performance Considerations](#performance-considerations)
12. [Security](#security)

---

## Architecture Overview

WebWaka implements a **true offline-first architecture** where the local device is the source of truth, and the server is a synchronization target. This inverts the traditional client-server model and ensures users can always work, regardless of connectivity.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│  (React, React Native, Vue, etc.)                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Logic Layer                    │
│  - Business logic                                           │
│  - Validation                                               │
│  - UI state management                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Offline-First Data Layer                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Local     │  │ Transaction  │  │  Sync Engine     │  │
│  │   Store     │  │    Queue     │  │                  │  │
│  │ (IndexedDB/ │  │   (FIFO +    │  │ - Auto sync      │  │
│  │   SQLite)   │  │  Priority)   │  │ - Manual sync    │  │
│  └─────────────┘  └──────────────┘  │ - Periodic sync  │  │
│                                      └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Network Abstraction                       │
│  - Network detection                                        │
│  - Retry logic                                              │
│  - Request queuing                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Server (Cloud)                          │
│  - REST API                                                 │
│  - WebSocket (optional)                                     │
│  - Conflict resolution                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Local-First

**Principle:** The local device is the source of truth. All operations succeed locally first, then sync to the server.

**Implementation:**
- All write operations (create, update, delete) succeed immediately on the local store
- No network call is required for operations to complete
- Server is a replication target, not a gatekeeper

### 2. Eventual Consistency

**Principle:** Data will eventually be consistent across all devices, but may be temporarily inconsistent.

**Implementation:**
- Accept that conflicts will occur
- Implement deterministic conflict resolution
- Use vector clocks or timestamps for versioning

### 3. Optimistic UI

**Principle:** Show the user immediate feedback assuming the operation will succeed.

**Implementation:**
- Update UI immediately after local write
- Show "pending sync" indicators for unsynced changes
- Rollback UI if sync fails (rare)

### 4. Graceful Degradation

**Principle:** Features degrade gracefully when offline, with clear communication to the user.

**Implementation:**
- Disable online-only features with clear messaging
- Show offline indicators in the UI
- Queue operations that require connectivity

---

## Interaction Classes (INV-010)

WebWaka categorizes all interactions into four classes based on their offline requirements:

### CLASS_D: Critical Transactions

**Definition:** Operations that MUST work offline and MUST NOT be blocked by network latency.

**Examples:**
- Task CRUD operations
- Order creation
- Data viewing
- Session management

**Requirements:**
- ✅ MUST succeed locally immediately
- ✅ MUST persist across app restarts
- ✅ MUST sync automatically when online
- ✅ MUST have conflict resolution

**Implementation:**
```typescript
async function createTask(task: Task): Promise<Task> {
  // 1. Validate locally
  validateTask(task);
  
  // 2. Generate temp ID
  const tempId = generateTempId();
  task.id = tempId;
  
  // 3. Save to local store
  await localStore.save('tasks', task);
  
  // 4. Queue for sync
  await transactionQueue.enqueue({
    type: 'CREATE',
    entity: 'task',
    data: task,
    timestamp: Date.now()
  });
  
  // 5. Return immediately
  return task;
}
```

---

### CLASS_C: Low-Latency Interactions

**Definition:** Operations that benefit from low latency but can tolerate delays.

**Examples:**
- Search
- File attachments
- Autocomplete

**Requirements:**
- ⚠️ SHOULD work offline on cached data
- ⚠️ MAY have limited functionality offline
- ⚠️ SHOULD clearly indicate limitations

**Implementation:**
```typescript
async function searchTasks(query: string): Promise<Task[]> {
  // 1. Check connectivity
  if (isOnline()) {
    // Search server index
    return await api.searchTasks(query);
  } else {
    // Search local cache
    const results = await localStore.search('tasks', query);
    // Show indicator: "Searching cached data only"
    showOfflineSearchIndicator();
    return results;
  }
}
```

---

### CLASS_B: Event Streaming

**Definition:** Operations that stream events but can fall back to polling or queuing.

**Examples:**
- Notifications
- Activity feeds
- File uploads

**Requirements:**
- ⚠️ MUST have async fallback
- ⚠️ SHOULD queue when offline
- ⚠️ SHOULD sync when online

**Implementation:**
```typescript
async function uploadFile(file: File): Promise<void> {
  if (isOnline()) {
    // Upload immediately
    await api.uploadFile(file);
  } else {
    // Queue for upload
    await uploadQueue.enqueue(file);
    showNotification('File will upload when online');
  }
}
```

---

### CLASS_A: Live Presence

**Definition:** Operations that require live connectivity and are optional.

**Examples:**
- Real-time collaboration cursors
- Online/offline status indicators
- Live chat

**Requirements:**
- ❌ MAY be unavailable offline
- ✅ MUST degrade gracefully
- ✅ MUST NOT block core functionality

**Implementation:**
```typescript
function initializePresence() {
  if (isOnline()) {
    // Connect to presence service
    presenceService.connect();
  } else {
    // Hide presence indicators
    hidePresenceIndicators();
  }
}
```

---

## Local Data Persistence

### Storage Backend

| Platform | Storage Backend | Max Size |
|----------|----------------|----------|
| Web | IndexedDB | 50MB default, 500MB max |
| iOS | SQLite (via SQLite.swift) | 500MB max |
| Android | SQLite (via Room) | 500MB max |
| Desktop | SQLite | 1GB max |

### Data Model

```typescript
interface LocalEntity {
  id: string;              // UUID or temp ID
  type: string;            // Entity type (task, order, etc.)
  data: any;               // Entity data
  version: number;         // Version number for conflict resolution
  timestamp: number;       // Last modified timestamp
  syncStatus: SyncStatus;  // 'synced' | 'pending' | 'conflict'
  deleted: boolean;        // Soft delete flag
}

enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  CONFLICT = 'conflict'
}
```

### Storage API

```typescript
interface LocalStore {
  // CRUD operations
  save(type: string, entity: any): Promise<void>;
  get(type: string, id: string): Promise<any>;
  update(type: string, id: string, changes: Partial<any>): Promise<void>;
  delete(type: string, id: string): Promise<void>;
  
  // Query operations
  list(type: string, filter?: Filter): Promise<any[]>;
  search(type: string, query: string): Promise<any[]>;
  
  // Sync operations
  getPendingSync(type: string): Promise<any[]>;
  markSynced(type: string, id: string, serverId: string): Promise<void>;
  markConflict(type: string, id: string, conflict: Conflict): Promise<void>;
  
  // Maintenance
  clear(type: string): Promise<void>;
  vacuum(): Promise<void>;
  getStorageUsage(): Promise<StorageUsage>;
}
```

### Encryption at Rest

All local data is encrypted using **AES-256-GCM**:

```typescript
async function encryptData(data: any, key: CryptoKey): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  
  // Prepend IV to encrypted data
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);
  
  return result.buffer;
}
```

---

## Transaction Queue

### Queue Structure

```typescript
interface Transaction {
  id: string;              // Transaction ID
  type: TransactionType;   // CREATE, UPDATE, DELETE
  entity: string;          // Entity type
  entityId: string;        // Entity ID (temp or real)
  data: any;               // Transaction data
  timestamp: number;       // Creation timestamp
  retries: number;         // Retry count
  priority: Priority;      // HIGH, NORMAL, LOW
  status: QueueStatus;     // PENDING, PROCESSING, FAILED
}

enum TransactionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

enum Priority {
  HIGH = 1,
  NORMAL = 2,
  LOW = 3
}

enum QueueStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  FAILED = 'failed'
}
```

### Queue Operations

```typescript
interface TransactionQueue {
  // Enqueue operations
  enqueue(transaction: Transaction): Promise<void>;
  enqueueBatch(transactions: Transaction[]): Promise<void>;
  
  // Dequeue operations
  dequeue(): Promise<Transaction | null>;
  dequeueBatch(count: number): Promise<Transaction[]>;
  
  // Query operations
  getPending(): Promise<Transaction[]>;
  getFailed(): Promise<Transaction[]>;
  getByEntity(entityType: string, entityId: string): Promise<Transaction[]>;
  
  // Status operations
  markProcessing(id: string): Promise<void>;
  markCompleted(id: string): Promise<void>;
  markFailed(id: string, error: Error): Promise<void>;
  
  // Maintenance
  clear(): Promise<void>;
  retry(id: string): Promise<void>;
  retryAll(): Promise<void>;
}
```

### Retry Strategy

```typescript
async function processQueue() {
  while (true) {
    const transaction = await queue.dequeue();
    if (!transaction) break;
    
    try {
      await queue.markProcessing(transaction.id);
      await syncTransaction(transaction);
      await queue.markCompleted(transaction.id);
    } catch (error) {
      transaction.retries++;
      
      if (transaction.retries < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = Math.pow(2, transaction.retries) * 1000;
        await sleep(delay);
        await queue.retry(transaction.id);
      } else {
        await queue.markFailed(transaction.id, error);
        showNotification(`Failed to sync ${transaction.entity}`);
      }
    }
  }
}
```

---

## Synchronization Engine

### Sync Triggers

1. **On Reconnect** - Automatic sync when network connectivity is restored
2. **Manual** - User-triggered sync (pull-to-refresh, sync button)
3. **Periodic** - Background sync every 5 minutes (when online)
4. **On Mutation** - Immediate sync attempt after local write (if online)

### Sync Process

```typescript
async function sync() {
  // 1. Check connectivity
  if (!isOnline()) {
    console.log('Offline - sync skipped');
    return;
  }
  
  // 2. Get pending transactions
  const pending = await queue.getPending();
  if (pending.length === 0) {
    console.log('No pending transactions');
    return;
  }
  
  // 3. Show sync indicator
  showSyncIndicator(pending.length);
  
  // 4. Process transactions in order
  for (const transaction of pending) {
    try {
      await syncTransaction(transaction);
      await queue.markCompleted(transaction.id);
      updateSyncProgress();
    } catch (error) {
      if (isConflictError(error)) {
        await handleConflict(transaction, error);
      } else {
        await queue.markFailed(transaction.id, error);
      }
    }
  }
  
  // 5. Pull server changes
  await pullServerChanges();
  
  // 6. Hide sync indicator
  hideSyncIndicator();
}
```

### Delta Sync

To minimize bandwidth, WebWaka uses delta sync:

```typescript
async function pullServerChanges() {
  // Get last sync timestamp
  const lastSync = await localStore.getLastSyncTimestamp();
  
  // Request only changes since last sync
  const changes = await api.getChangesSince(lastSync);
  
  // Apply changes to local store
  for (const change of changes) {
    if (change.type === 'CREATE' || change.type === 'UPDATE') {
      await localStore.save(change.entity, change.data);
    } else if (change.type === 'DELETE') {
      await localStore.delete(change.entity, change.id);
    }
  }
  
  // Update last sync timestamp
  await localStore.setLastSyncTimestamp(Date.now());
}
```

---

## Conflict Resolution

### Conflict Detection

Conflicts occur when:
1. Same entity modified offline and online
2. Entity deleted offline but modified online
3. Entity modified offline but deleted online

### Conflict Resolution Strategies

```typescript
enum ResolutionStrategy {
  LAST_WRITE_WINS = 'last_write_wins',  // Most recent change wins
  FIRST_WRITE_WINS = 'first_write_wins', // First change wins
  MANUAL = 'manual',                     // User chooses
  MERGE = 'merge'                        // Attempt to merge changes
}
```

### Implementation

```typescript
async function resolveConflict(
  local: LocalEntity,
  server: ServerEntity,
  strategy: ResolutionStrategy
): Promise<Entity> {
  switch (strategy) {
    case ResolutionStrategy.LAST_WRITE_WINS:
      return local.timestamp > server.timestamp ? local : server;
    
    case ResolutionStrategy.FIRST_WRITE_WINS:
      return local.timestamp < server.timestamp ? local : server;
    
    case ResolutionStrategy.MANUAL:
      return await promptUserForResolution(local, server);
    
    case ResolutionStrategy.MERGE:
      return await attemptMerge(local, server);
    
    default:
      throw new Error(`Unknown resolution strategy: ${strategy}`);
  }
}
```

### Vector Clocks

For advanced conflict detection, WebWaka uses vector clocks:

```typescript
interface VectorClock {
  [deviceId: string]: number;
}

function compareVectorClocks(a: VectorClock, b: VectorClock): Comparison {
  let aGreater = false;
  let bGreater = false;
  
  const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);
  
  for (const device of allDevices) {
    const aVersion = a[device] || 0;
    const bVersion = b[device] || 0;
    
    if (aVersion > bVersion) aGreater = true;
    if (bVersion > aVersion) bGreater = true;
  }
  
  if (aGreater && !bGreater) return Comparison.GREATER;
  if (bGreater && !aGreater) return Comparison.LESS;
  if (!aGreater && !bGreater) return Comparison.EQUAL;
  return Comparison.CONCURRENT; // Conflict!
}
```

---

## Session Management

### Session Structure

```typescript
interface OfflineSession {
  userId: string;
  sessionId: string;
  token: string;           // JWT or similar
  permissions: Permission[];
  createdAt: number;
  expiresAt: number;       // Max 24 hours
  lastActivity: number;
  locked: boolean;
}
```

### Session Lifecycle

```typescript
async function initializeSession(credentials: Credentials): Promise<Session> {
  // 1. Authenticate with server (requires connectivity)
  const session = await api.authenticate(credentials);
  
  // 2. Cache session locally (encrypted)
  await localStore.saveSession(session);
  
  // 3. Set expiration (24 hours max)
  session.expiresAt = Date.now() + (24 * 60 * 60 * 1000);
  
  // 4. Start inactivity timer
  startInactivityTimer();
  
  return session;
}

async function validateSession(): Promise<boolean> {
  const session = await localStore.getSession();
  
  // Check expiration
  if (Date.now() > session.expiresAt) {
    await localStore.clearSession();
    return false;
  }
  
  // Check lock status
  if (session.locked) {
    await promptForReVerification();
    return false;
  }
  
  return true;
}
```

### Inactivity Timeout

```typescript
let inactivityTimer: NodeJS.Timeout | null = null;

function startInactivityTimer() {
  resetInactivityTimer();
  
  // Listen for user activity
  document.addEventListener('mousemove', resetInactivityTimer);
  document.addEventListener('keypress', resetInactivityTimer);
  document.addEventListener('touchstart', resetInactivityTimer);
}

function resetInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  
  // Lock session after 30 minutes of inactivity
  inactivityTimer = setTimeout(async () => {
    await lockSession();
  }, 30 * 60 * 1000);
}

async function lockSession() {
  const session = await localStore.getSession();
  session.locked = true;
  await localStore.saveSession(session);
  
  showLockScreen();
}
```

---

## Implementation Guide

### Step 1: Set Up Local Store

```typescript
// Initialize IndexedDB (web)
const db = await openDB('webwaka', 1, {
  upgrade(db) {
    // Create object stores
    db.createObjectStore('tasks', { keyPath: 'id' });
    db.createObjectStore('orders', { keyPath: 'id' });
    db.createObjectStore('queue', { keyPath: 'id' });
    db.createObjectStore('session', { keyPath: 'userId' });
  }
});
```

### Step 2: Implement Transaction Queue

```typescript
class TransactionQueue {
  async enqueue(transaction: Transaction): Promise<void> {
    transaction.id = generateUUID();
    transaction.status = QueueStatus.PENDING;
    transaction.retries = 0;
    
    await db.put('queue', transaction);
  }
  
  async dequeue(): Promise<Transaction | null> {
    const pending = await db.getAll('queue');
    const sorted = pending
      .filter(t => t.status === QueueStatus.PENDING)
      .sort((a, b) => a.priority - b.priority || a.timestamp - b.timestamp);
    
    return sorted[0] || null;
  }
}
```

### Step 3: Implement Sync Engine

```typescript
class SyncEngine {
  private syncing = false;
  
  async sync(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    
    try {
      await this.pushLocalChanges();
      await this.pullServerChanges();
    } finally {
      this.syncing = false;
    }
  }
  
  private async pushLocalChanges(): Promise<void> {
    const queue = new TransactionQueue();
    const pending = await queue.getPending();
    
    for (const transaction of pending) {
      await this.syncTransaction(transaction);
    }
  }
  
  private async syncTransaction(transaction: Transaction): Promise<void> {
    switch (transaction.type) {
      case TransactionType.CREATE:
        await api.create(transaction.entity, transaction.data);
        break;
      case TransactionType.UPDATE:
        await api.update(transaction.entity, transaction.entityId, transaction.data);
        break;
      case TransactionType.DELETE:
        await api.delete(transaction.entity, transaction.entityId);
        break;
    }
  }
}
```

### Step 4: Handle Network Events

```typescript
// Listen for online/offline events
window.addEventListener('online', async () => {
  console.log('Network restored');
  await syncEngine.sync();
});

window.addEventListener('offline', () => {
  console.log('Network lost');
  showOfflineIndicator();
});

// Check connectivity
function isOnline(): boolean {
  return navigator.onLine;
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('LocalStore', () => {
  it('should save entity locally', async () => {
    const task = { id: '1', title: 'Test Task' };
    await localStore.save('tasks', task);
    
    const retrieved = await localStore.get('tasks', '1');
    expect(retrieved).toEqual(task);
  });
  
  it('should mark entity as pending sync', async () => {
    const task = { id: '1', title: 'Test Task' };
    await localStore.save('tasks', task);
    
    const pending = await localStore.getPendingSync('tasks');
    expect(pending).toContainEqual(task);
  });
});
```

### Integration Tests

```typescript
describe('Offline Task Creation', () => {
  it('should create task offline and sync when online', async () => {
    // Go offline
    mockNetworkOffline();
    
    // Create task
    const task = await createTask({ title: 'Offline Task' });
    expect(task.id).toBeDefined();
    
    // Verify task in local store
    const local = await localStore.get('tasks', task.id);
    expect(local).toEqual(task);
    
    // Go online
    mockNetworkOnline();
    await syncEngine.sync();
    
    // Verify task synced to server
    const server = await api.getTask(task.id);
    expect(server).toEqual(task);
  });
});
```

### End-to-End Tests

```typescript
describe('Offline Mode E2E', () => {
  it('should handle app restart during offline mode', async () => {
    // Create task offline
    mockNetworkOffline();
    const task = await createTask({ title: 'Test Task' });
    
    // Simulate app restart
    await restartApp();
    
    // Verify task persists
    const tasks = await localStore.list('tasks');
    expect(tasks).toContainEqual(task);
    
    // Go online and sync
    mockNetworkOnline();
    await syncEngine.sync();
    
    // Verify task synced
    const server = await api.getTask(task.id);
    expect(server).toEqual(task);
  });
});
```

---

## Performance Considerations

### Indexing

Create indexes on frequently queried fields:

```typescript
db.createObjectStore('tasks', { keyPath: 'id' });
db.createIndex('by_status', 'status');
db.createIndex('by_priority', 'priority');
db.createIndex('by_timestamp', 'timestamp');
```

### Batch Operations

Batch database operations for better performance:

```typescript
async function saveBatch(entities: Entity[]): Promise<void> {
  const tx = db.transaction('tasks', 'readwrite');
  await Promise.all(entities.map(e => tx.store.put(e)));
  await tx.done;
}
```

### Lazy Loading

Load data on demand, not all at once:

```typescript
async function loadTasks(page: number, pageSize: number): Promise<Task[]> {
  const offset = page * pageSize;
  const tasks = await db.getAll('tasks', undefined, pageSize, offset);
  return tasks;
}
```

---

## Security

### Encryption Key Management

```typescript
// Derive encryption key from user password
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
```

### Secure Session Storage

```typescript
async function saveSession(session: Session): Promise<void> {
  const key = await getEncryptionKey();
  const encrypted = await encryptData(session, key);
  await db.put('session', { userId: session.userId, data: encrypted });
}
```

---

## Conclusion

WebWaka's offline-first architecture ensures users can always work, regardless of connectivity. By following the principles and patterns outlined in this guide, developers can build robust offline-capable features that provide a seamless user experience.

**Key Takeaways:**
- Local device is the source of truth
- All critical operations (CLASS_D) work offline
- Conflicts are detected and resolved deterministically
- Data is encrypted at rest
- Sessions are bounded and secure

For questions or contributions, contact the WebWaka platform team.

---

**Document Version:** 1.0  
**Last Updated:** February 1, 2026  
**Maintained By:** WebWaka Platform Team
