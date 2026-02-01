# WebWaka Offline Data Retention & Quota Policy

**Version:** 1.0  
**Last Updated:** February 1, 2026  
**Issue:** #36 (OFF-003)

---

## Table of Contents

1. [Overview](#overview)
2. [Retention Rules](#retention-rules)
3. [Storage Quota Management](#storage-quota-management)
4. [Graceful Degradation Strategy](#graceful-degradation-strategy)
5. [Data Lifecycle Management](#data-lifecycle-management)
6. [Configuration & Monitoring](#configuration--monitoring)
7. [User Control](#user-control)
8. [Implementation Guide](#implementation-guide)
9. [Testing Strategy](#testing-strategy)

---

## Overview

WebWaka's offline-first architecture requires careful management of local storage to prevent exhaustion. This specification defines retention policies, quota limits, and cleanup strategies to ensure the app remains functional even with limited storage.

### Core Principles

1. **Prevent storage exhaustion** - Never run out of storage
2. **Graceful degradation** - Delete oldest data first when quota exceeded
3. **User transparency** - Show storage usage and allow manual cleanup
4. **Automatic cleanup** - Remove synced and old data automatically
5. **Configurable limits** - Quota adjustable per device

---

## Retention Rules

### Rule 1: Synced Data

**Rule:** Delete data after successful sync to server.

**Exceptions:**
- Recently accessed data (within 7 days) - keep cached
- User-pinned data - keep until user unpins
- Data required for offline operations - keep until no longer needed

```typescript
interface RetentionRule {
  name: string;
  condition: (entity: Entity) => boolean;
  action: 'delete' | 'keep';
  priority: number;
}

const SYNCED_DATA_RULE: RetentionRule = {
  name: 'synced_data',
  condition: (entity) => {
    return entity.syncStatus === 'synced' &&
           entity.lastAccessedAt < Date.now() - (7 * 24 * 60 * 60 * 1000) &&
           !entity.pinned;
  },
  action: 'delete',
  priority: 1
};
```

### Rule 2: Old Data

**Rule:** Delete data older than 30 days, regardless of sync status.

**Exceptions:**
- User-pinned data - keep until user unpins
- Data with pending transactions - keep until synced

```typescript
const OLD_DATA_RULE: RetentionRule = {
  name: 'old_data',
  condition: (entity) => {
    const age = Date.now() - entity.createdAt;
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    return age > maxAge &&
           !entity.pinned &&
           !entity.hasPendingTransactions;
  },
  action: 'delete',
  priority: 2
};
```

### Rule 3: Unsynced Data

**Rule:** Keep unsynced data indefinitely (until synced or 30 days).

```typescript
const UNSYNCED_DATA_RULE: RetentionRule = {
  name: 'unsynced_data',
  condition: (entity) => {
    return entity.syncStatus === 'pending' ||
           entity.syncStatus === 'failed';
  },
  action: 'keep',
  priority: 10
};
```

### Rule Priority

Rules are evaluated in priority order (higher priority = evaluated first):

1. **Priority 10:** Keep unsynced data
2. **Priority 5:** Keep pinned data
3. **Priority 2:** Delete old data (30+ days)
4. **Priority 1:** Delete synced data (7+ days since last access)

---

## Storage Quota Management

### Quota Limits

```typescript
interface QuotaConfig {
  defaultQuota: number;      // 50MB default
  warningThreshold: number;  // 80% of quota
  criticalThreshold: number; // 95% of quota
  minFreeSpace: number;      // 5MB minimum free space
}

const DEFAULT_QUOTA_CONFIG: QuotaConfig = {
  defaultQuota: 50 * 1024 * 1024,      // 50MB
  warningThreshold: 0.8,                // 80%
  criticalThreshold: 0.95,              // 95%
  minFreeSpace: 5 * 1024 * 1024        // 5MB
};
```

### Storage Breakdown

| Category | Default Limit | Description |
|----------|---------------|-------------|
| **Entities** | 30MB | Tasks, orders, sessions, etc. |
| **Transaction Queue** | 10MB | Pending transactions |
| **Conflict Archive** | 5MB | Conflict versions |
| **Cache** | 5MB | Temporary cached data |
| **Total** | 50MB | Overall quota |

### Quota Tracking

```typescript
interface StorageUsage {
  total: number;           // Total used (bytes)
  entities: number;        // Entities storage (bytes)
  transactions: number;    // Transaction queue (bytes)
  conflicts: number;       // Conflict archive (bytes)
  cache: number;          // Cache storage (bytes)
  quota: number;          // Total quota (bytes)
  available: number;      // Available space (bytes)
  percentage: number;     // Usage percentage (0-100)
}

class QuotaManager {
  async getStorageUsage(): Promise<StorageUsage> {
    const entities = await this.calculateEntityStorage();
    const transactions = await this.calculateTransactionStorage();
    const conflicts = await this.calculateConflictStorage();
    const cache = await this.calculateCacheStorage();
    
    const total = entities + transactions + conflicts + cache;
    const quota = await this.getQuota();
    const available = Math.max(0, quota - total);
    const percentage = (total / quota) * 100;
    
    return {
      total,
      entities,
      transactions,
      conflicts,
      cache,
      quota,
      available,
      percentage
    };
  }
  
  async checkQuota(): Promise<QuotaStatus> {
    const usage = await this.getStorageUsage();
    
    if (usage.percentage >= DEFAULT_QUOTA_CONFIG.criticalThreshold * 100) {
      return {
        status: 'critical',
        message: 'Storage almost full. Cleanup recommended.',
        usage
      };
    } else if (usage.percentage >= DEFAULT_QUOTA_CONFIG.warningThreshold * 100) {
      return {
        status: 'warning',
        message: 'Storage usage high. Consider cleanup.',
        usage
      };
    } else {
      return {
        status: 'ok',
        message: 'Storage usage normal.',
        usage
      };
    }
  }
}
```

---

## Graceful Degradation Strategy

### LRU (Least Recently Used) Deletion

When quota is exceeded, delete data in this order:

1. **Cached data** - Delete all cache (most expendable)
2. **Synced entities** - Delete oldest synced entities (by last access time)
3. **Old conflict archives** - Delete resolved conflicts older than 7 days
4. **Transaction logs** - Delete completed transaction logs older than 7 days

```typescript
class GracefulDegradationManager {
  async handleQuotaExceeded(): Promise<void> {
    console.log('Quota exceeded - starting graceful degradation');
    
    // Step 1: Clear cache
    const cacheFreed = await this.clearCache();
    console.log(`Freed ${cacheFreed} bytes from cache`);
    
    if (await this.isQuotaOk()) {
      return;
    }
    
    // Step 2: Delete synced entities (LRU)
    const entitiesFreed = await this.deleteSyncedEntitiesLRU(10);
    console.log(`Freed ${entitiesFreed} bytes from synced entities`);
    
    if (await this.isQuotaOk()) {
      return;
    }
    
    // Step 3: Delete old conflict archives
    const conflictsFreed = await this.deleteOldConflicts();
    console.log(`Freed ${conflictsFreed} bytes from conflict archives`);
    
    if (await this.isQuotaOk()) {
      return;
    }
    
    // Step 4: Delete old transaction logs
    const logsFreed = await this.deleteOldTransactionLogs();
    console.log(`Freed ${logsFreed} bytes from transaction logs`);
    
    if (!await this.isQuotaOk()) {
      console.warn('Unable to free enough space. User action required.');
      this.notifyUser();
    }
  }
  
  private async deleteSyncedEntitiesLRU(count: number): Promise<number> {
    // Get synced entities sorted by last access time (oldest first)
    const entities = await localStore.query({
      syncStatus: 'synced',
      pinned: false
    });
    
    entities.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
    
    let freedBytes = 0;
    
    for (let i = 0; i < Math.min(count, entities.length); i++) {
      const entity = entities[i];
      const size = await this.getEntitySize(entity);
      
      await localStore.delete(entity.type, entity.id);
      freedBytes += size;
      
      console.log(`Deleted entity ${entity.id} (${size} bytes)`);
    }
    
    return freedBytes;
  }
  
  private async clearCache(): Promise<number> {
    const cacheSize = await this.calculateCacheStorage();
    await localStore.clearCache();
    return cacheSize;
  }
  
  private async deleteOldConflicts(): Promise<number> {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    const conflicts = await localStore.query({
      type: 'conflict_archive',
      resolvedAt: { $lt: cutoff }
    });
    
    let freedBytes = 0;
    
    for (const conflict of conflicts) {
      const size = await this.getEntitySize(conflict);
      await localStore.delete('conflict_archive', conflict.id);
      freedBytes += size;
    }
    
    return freedBytes;
  }
  
  private async deleteOldTransactionLogs(): Promise<number> {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    const logs = await localStore.query({
      type: 'transaction_log',
      status: 'completed',
      completedAt: { $lt: cutoff }
    });
    
    let freedBytes = 0;
    
    for (const log of logs) {
      const size = await this.getEntitySize(log);
      await localStore.delete('transaction_log', log.id);
      freedBytes += size;
    }
    
    return freedBytes;
  }
}
```

### Quota Exceeded Behavior

```typescript
async function handleStorageOperation(operation: () => Promise<void>): Promise<void> {
  try {
    // Check quota before operation
    const quotaStatus = await quotaManager.checkQuota();
    
    if (quotaStatus.status === 'critical') {
      // Trigger graceful degradation
      await gracefulDegradationManager.handleQuotaExceeded();
    }
    
    // Perform operation
    await operation();
    
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      // Browser quota exceeded
      console.error('Browser storage quota exceeded');
      
      // Trigger aggressive cleanup
      await gracefulDegradationManager.handleQuotaExceeded();
      
      // Retry operation
      await operation();
    } else {
      throw error;
    }
  }
}
```

---

## Data Lifecycle Management

### Automatic Cleanup

```typescript
class DataLifecycleManager {
  private cleanupInterval: number = 60 * 60 * 1000; // 1 hour
  
  startAutomaticCleanup(): void {
    setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);
  }
  
  async performCleanup(): Promise<CleanupResult> {
    console.log('Starting automatic cleanup...');
    
    const result: CleanupResult = {
      syncedDataDeleted: 0,
      oldDataDeleted: 0,
      cacheCleared: 0,
      totalFreed: 0
    };
    
    // Apply retention rules
    const rules = [
      OLD_DATA_RULE,
      SYNCED_DATA_RULE
    ];
    
    for (const rule of rules) {
      const entities = await this.findEntitiesMatchingRule(rule);
      
      for (const entity of entities) {
        const size = await this.getEntitySize(entity);
        await localStore.delete(entity.type, entity.id);
        
        if (rule.name === 'old_data') {
          result.oldDataDeleted++;
        } else if (rule.name === 'synced_data') {
          result.syncedDataDeleted++;
        }
        
        result.totalFreed += size;
      }
    }
    
    // Clear expired cache
    const cacheFreed = await this.clearExpiredCache();
    result.cacheCleared = cacheFreed;
    result.totalFreed += cacheFreed;
    
    console.log('Automatic cleanup completed:', result);
    
    return result;
  }
  
  private async findEntitiesMatchingRule(rule: RetentionRule): Promise<Entity[]> {
    const allEntities = await localStore.getAllEntities();
    return allEntities.filter(entity => rule.condition(entity));
  }
}
```

### Manual Cleanup

```typescript
async function manualCleanup(options: CleanupOptions): Promise<CleanupResult> {
  const result: CleanupResult = {
    syncedDataDeleted: 0,
    oldDataDeleted: 0,
    cacheCleared: 0,
    totalFreed: 0
  };
  
  if (options.clearCache) {
    const cacheFreed = await localStore.clearCache();
    result.cacheCleared = cacheFreed;
    result.totalFreed += cacheFreed;
  }
  
  if (options.deleteSyncedData) {
    const entities = await localStore.query({ syncStatus: 'synced' });
    
    for (const entity of entities) {
      if (options.olderThan && entity.lastAccessedAt > options.olderThan) {
        continue; // Skip recent data
      }
      
      const size = await getEntitySize(entity);
      await localStore.delete(entity.type, entity.id);
      result.syncedDataDeleted++;
      result.totalFreed += size;
    }
  }
  
  if (options.deleteOldData) {
    const cutoff = Date.now() - (options.olderThanDays || 30) * 24 * 60 * 60 * 1000;
    const entities = await localStore.query({
      createdAt: { $lt: cutoff },
      pinned: false
    });
    
    for (const entity of entities) {
      const size = await getEntitySize(entity);
      await localStore.delete(entity.type, entity.id);
      result.oldDataDeleted++;
      result.totalFreed += size;
    }
  }
  
  return result;
}
```

---

## Configuration & Monitoring

### Configuration

```typescript
interface StorageConfig {
  quota: number;
  retentionDays: number;
  autoCleanup: boolean;
  cleanupInterval: number;
  warningThreshold: number;
  criticalThreshold: number;
}

class StorageConfigManager {
  async getConfig(): Promise<StorageConfig> {
    const config = await localStore.get('storage_config', 'default');
    
    return config || {
      quota: 50 * 1024 * 1024,
      retentionDays: 30,
      autoCleanup: true,
      cleanupInterval: 60 * 60 * 1000,
      warningThreshold: 0.8,
      criticalThreshold: 0.95
    };
  }
  
  async updateConfig(updates: Partial<StorageConfig>): Promise<void> {
    const config = await this.getConfig();
    const newConfig = { ...config, ...updates };
    await localStore.save('storage_config', newConfig);
  }
}
```

### Monitoring

```typescript
interface StorageMetrics {
  timestamp: number;
  usage: StorageUsage;
  cleanupEvents: number;
  quotaExceededEvents: number;
  entitiesCount: number;
  transactionsCount: number;
}

class StorageMonitor {
  async collectMetrics(): Promise<StorageMetrics> {
    const usage = await quotaManager.getStorageUsage();
    const entitiesCount = await localStore.count('entities');
    const transactionsCount = await localStore.count('transactions');
    
    return {
      timestamp: Date.now(),
      usage,
      cleanupEvents: await this.getCleanupEventCount(),
      quotaExceededEvents: await this.getQuotaExceededEventCount(),
      entitiesCount,
      transactionsCount
    };
  }
  
  async trackMetrics(): Promise<void> {
    const metrics = await this.collectMetrics();
    
    // Log locally
    await localStore.save('storage_metrics', metrics);
    
    // Send to analytics (when online)
    await analytics.track('storage_metrics', metrics);
  }
}
```

---

## User Control

### Storage Status UI

```typescript
function StorageStatusCard() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  
  useEffect(() => {
    loadStorageUsage();
  }, []);
  
  const loadStorageUsage = async () => {
    const usage = await quotaManager.getStorageUsage();
    setUsage(usage);
  };
  
  if (!usage) return <Loading />;
  
  const statusColor = usage.percentage >= 95 ? 'red' :
                     usage.percentage >= 80 ? 'yellow' : 'green';
  
  return (
    <Card>
      <CardHeader>
        <h3>Storage Status</h3>
        <Badge color={statusColor}>
          {usage.percentage.toFixed(1)}% Used
        </Badge>
      </CardHeader>
      
      <CardBody>
        <ProgressBar
          value={usage.percentage}
          color={statusColor}
        />
        
        <StorageBreakdown>
          <BreakdownItem
            label="Entities"
            value={formatBytes(usage.entities)}
            percentage={(usage.entities / usage.total) * 100}
          />
          <BreakdownItem
            label="Transactions"
            value={formatBytes(usage.transactions)}
            percentage={(usage.transactions / usage.total) * 100}
          />
          <BreakdownItem
            label="Conflicts"
            value={formatBytes(usage.conflicts)}
            percentage={(usage.conflicts / usage.total) * 100}
          />
          <BreakdownItem
            label="Cache"
            value={formatBytes(usage.cache)}
            percentage={(usage.cache / usage.total) * 100}
          />
        </StorageBreakdown>
        
        <p className="text-muted">
          {formatBytes(usage.available)} of {formatBytes(usage.quota)} available
        </p>
      </CardBody>
      
      <CardActions>
        <Button onClick={() => performManualCleanup()}>
          Clean Up Now
        </Button>
        <Button variant="secondary" onClick={() => openStorageSettings()}>
          Settings
        </Button>
      </CardActions>
    </Card>
  );
}
```

### Manual Cleanup Dialog

```typescript
function ManualCleanupDialog({ onClose }: { onClose: () => void }) {
  const [options, setOptions] = useState<CleanupOptions>({
    clearCache: true,
    deleteSyncedData: true,
    deleteOldData: false,
    olderThanDays: 30
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  
  const handleCleanup = async () => {
    setLoading(true);
    
    try {
      const result = await manualCleanup(options);
      setResult(result);
    } catch (error) {
      console.error('Cleanup failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog title="Manual Cleanup" onClose={onClose}>
      {!result ? (
        <>
          <p>Select what to clean up:</p>
          
          <Checkbox
            label="Clear cache"
            checked={options.clearCache}
            onChange={v => setOptions({ ...options, clearCache: v })}
          />
          
          <Checkbox
            label="Delete synced data (older than 7 days)"
            checked={options.deleteSyncedData}
            onChange={v => setOptions({ ...options, deleteSyncedData: v })}
          />
          
          <Checkbox
            label="Delete old data"
            checked={options.deleteOldData}
            onChange={v => setOptions({ ...options, deleteOldData: v })}
          />
          
          {options.deleteOldData && (
            <Input
              type="number"
              label="Older than (days)"
              value={options.olderThanDays}
              onChange={v => setOptions({ ...options, olderThanDays: v })}
            />
          )}
          
          <Actions>
            <Button onClick={onClose} variant="secondary">
              Cancel
            </Button>
            <Button onClick={handleCleanup} loading={loading}>
              Clean Up
            </Button>
          </Actions>
        </>
      ) : (
        <>
          <Alert type="success">
            Cleanup completed successfully!
          </Alert>
          
          <CleanupSummary>
            <p><strong>Synced data deleted:</strong> {result.syncedDataDeleted} items</p>
            <p><strong>Old data deleted:</strong> {result.oldDataDeleted} items</p>
            <p><strong>Cache cleared:</strong> {formatBytes(result.cacheCleared)}</p>
            <p><strong>Total freed:</strong> {formatBytes(result.totalFreed)}</p>
          </CleanupSummary>
          
          <Actions>
            <Button onClick={onClose}>
              Close
            </Button>
          </Actions>
        </>
      )}
    </Dialog>
  );
}
```

---

## Implementation Guide

### Step 1: Set Up Quota Manager

```typescript
const quotaManager = new QuotaManager();

// Check quota periodically
setInterval(async () => {
  const status = await quotaManager.checkQuota();
  
  if (status.status === 'critical') {
    showNotification('Storage almost full', 'warning');
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

### Step 2: Set Up Lifecycle Manager

```typescript
const lifecycleManager = new DataLifecycleManager();

// Start automatic cleanup
lifecycleManager.startAutomaticCleanup();
```

### Step 3: Handle Quota Exceeded

```typescript
// Wrap all storage operations
async function saveEntity(entity: Entity): Promise<void> {
  await handleStorageOperation(async () => {
    await localStore.save(entity.type, entity);
  });
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('QuotaManager', () => {
  it('should calculate storage usage correctly', async () => {
    const usage = await quotaManager.getStorageUsage();
    expect(usage.total).toBeGreaterThan(0);
    expect(usage.percentage).toBeLessThanOrEqual(100);
  });
  
  it('should detect critical quota status', async () => {
    // Fill storage to 96%
    await fillStorage(0.96);
    
    const status = await quotaManager.checkQuota();
    expect(status.status).toBe('critical');
  });
});

describe('GracefulDegradationManager', () => {
  it('should free space when quota exceeded', async () => {
    const usageBefore = await quotaManager.getStorageUsage();
    
    await gracefulDegradationManager.handleQuotaExceeded();
    
    const usageAfter = await quotaManager.getStorageUsage();
    expect(usageAfter.total).toBeLessThan(usageBefore.total);
  });
});
```

---

## Conclusion

WebWaka's data retention and quota policy ensures:

1. ✅ **Prevent storage exhaustion** - Never run out of storage
2. ✅ **Graceful degradation** - Delete oldest data first when quota exceeded
3. ✅ **User transparency** - Show storage usage and allow manual cleanup
4. ✅ **Automatic cleanup** - Remove synced and old data automatically
5. ✅ **Configurable limits** - Quota adjustable per device

This policy maintains app functionality even with limited storage.

---

**Document Version:** 1.0  
**Last Updated:** February 1, 2026  
**Maintained By:** WebWaka Platform Team
