# Storage Abstraction Module

## Overview

This module implements OFF-001 — Local Offline Data Store Abstraction, providing a unified interface for persistent offline data storage across web and mobile platforms.

## Features

- ✅ **Backend-Agnostic Interface**: Write once, run on IndexedDB (web) or SQLite (mobile)
- ✅ **Offline-First**: Data persists across app restarts and network interruptions
- ✅ **Structured Queries**: Filter, sort, and paginate data with a rich query API
- ✅ **Encryption Ready**: Built-in hooks for transparent encryption (OFF-002)
- ✅ **Metadata Tracking**: Automatic versioning, timestamps, and integrity hashes
- ✅ **Type-Safe**: Full TypeScript support with generic types
- ✅ **Comprehensive Tests**: >90% test coverage with unit and integration tests

## Installation

```bash
# Install dependencies
npm install

# For mobile (React Native), also install:
npm install expo-sqlite
# or
npm install react-native-sqlite-storage
```

## Quick Start

### Web (IndexedDB)

```typescript
import { IndexedDBStorage } from './implementations/IndexedDBStorage';

const storage = new IndexedDBStorage();
await storage.initialize();

// Store data
await storage.set('users', 'user1', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Retrieve data
const user = await storage.get('users', 'user1');
console.log(user?.data);
```

### Mobile (SQLite)

```typescript
import { SQLiteStorage } from './implementations/SQLiteStorage';

const storage = new SQLiteStorage();
await storage.initialize({
  databasePath: 'webwaka.db'
});

// Same API as IndexedDB!
await storage.set('users', 'user1', {
  name: 'John Doe',
  email: 'john@example.com'
});
```

## API Reference

### IStorageAbstraction

The main interface that all storage backends implement.

#### `initialize(config?: Record<string, any>): Promise<void>`

Initialize the storage backend. Must be called before any other operations.

```typescript
await storage.initialize({
  databaseName: 'my_app',
  debug: true
});
```

#### `get<T>(collection: string, id: string): Promise<StorageEntity<T> | null>`

Retrieve an entity by ID.

```typescript
const user = await storage.get<User>('users', 'user1');
if (user) {
  console.log(user.data.name);
  console.log(user.metadata.version);
}
```

#### `set<T>(collection: string, id: string, data: T, options?: SetOptions): Promise<StorageEntity<T>>`

Create or update an entity.

```typescript
// Create new entity
await storage.set('users', 'user1', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Update with merge
await storage.set('users', 'user1', {
  email: 'john.doe@example.com'
}, { merge: true });

// Mark as synced
await storage.set('users', 'user1', data, { synced: true });
```

#### `query<T>(collection: string, options?: QueryOptions): Promise<QueryResult<T>>`

Query entities with filtering, sorting, and pagination.

```typescript
const result = await storage.query<User>('users', {
  conditions: [
    { field: 'data.age', operator: 'gte', value: 18 },
    { field: 'data.active', operator: 'eq', value: true }
  ],
  sort: [
    { field: 'data.name', direction: 'asc' }
  ],
  limit: 20,
  offset: 0
});

console.log(`Found ${result.totalCount} users`);
console.log(`Has more: ${result.hasMore}`);
```

#### `delete(collection: string, id: string): Promise<DeleteResult>`

Delete an entity by ID.

```typescript
const result = await storage.delete('users', 'user1');
if (result.deleted) {
  console.log('User deleted');
}
```

#### `clear(collection: string): Promise<number>`

Clear all entities in a collection.

```typescript
const count = await storage.clear('users');
console.log(`Deleted ${count} users`);
```

#### `clearAll(): Promise<number>`

Clear all data across all collections (secure wipe).

```typescript
const count = await storage.clearAll();
console.log(`Deleted ${count} total entities`);
```

#### `getStats(): Promise<StorageStats>`

Get storage statistics.

```typescript
const stats = await storage.getStats();
console.log(`Entities: ${stats.entityCount}`);
console.log(`Unsynced: ${stats.unsyncedCount}`);
console.log(`Size: ${stats.sizeBytes} bytes`);
console.log(`Quota: ${stats.quotaBytes} bytes`);
```

#### `setEncryptionHook(hook: EncryptionHook): void`

Register an encryption hook for transparent encryption.

```typescript
storage.setEncryptionHook({
  encrypt: async (data) => {
    // Encrypt data
    return encryptedString;
  },
  decrypt: async (encryptedData) => {
    // Decrypt data
    return decryptedData;
  }
});
```

#### `close(): Promise<void>`

Close the storage backend and release resources.

```typescript
await storage.close();
```

## Query Operators

The query system supports the following operators:

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equal | `{ field: 'age', operator: 'eq', value: 30 }` |
| `ne` | Not equal | `{ field: 'status', operator: 'ne', value: 'deleted' }` |
| `gt` | Greater than | `{ field: 'age', operator: 'gt', value: 18 }` |
| `gte` | Greater than or equal | `{ field: 'age', operator: 'gte', value: 18 }` |
| `lt` | Less than | `{ field: 'age', operator: 'lt', value: 65 }` |
| `lte` | Less than or equal | `{ field: 'age', operator: 'lte', value: 65 }` |
| `in` | In array | `{ field: 'role', operator: 'in', value: ['admin', 'moderator'] }` |
| `nin` | Not in array | `{ field: 'status', operator: 'nin', value: ['banned', 'deleted'] }` |
| `contains` | String contains | `{ field: 'email', operator: 'contains', value: '@example.com' }` |
| `startsWith` | String starts with | `{ field: 'name', operator: 'startsWith', value: 'John' }` |
| `endsWith` | String ends with | `{ field: 'email', operator: 'endsWith', value: '.com' }` |

## Metadata

Every stored entity includes comprehensive metadata:

```typescript
interface StorageMetadata {
  id: string;              // Unique identifier
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
  version: number;         // Auto-incrementing version
  hash: string;            // SHA-256 hash for integrity
  synced: boolean;         // Sync status
  lastSyncedAt: string | null;  // Last sync timestamp
}
```

## Error Handling

All operations may throw `StorageError` with specific error codes:

```typescript
try {
  await storage.get('users', 'user1');
} catch (error) {
  if (error instanceof StorageError) {
    switch (error.code) {
      case StorageErrorCode.NOT_INITIALIZED:
        console.error('Storage not initialized');
        break;
      case StorageErrorCode.NOT_FOUND:
        console.error('Entity not found');
        break;
      case StorageErrorCode.QUOTA_EXCEEDED:
        console.error('Storage quota exceeded');
        break;
      // ... handle other error codes
    }
  }
}
```

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test StorageAbstraction.test.ts
```

Expected coverage: >90%

## Performance Tips

1. **Use Pagination**: For large result sets, always use `limit` and `offset`
2. **Batch Operations**: Use `Promise.all()` for concurrent operations
3. **Index Wisely**: Query on indexed metadata fields when possible
4. **Merge Carefully**: Use `merge: true` only when necessary
5. **Close Connections**: Always call `close()` when done

## Architecture

See [Architecture Documentation](../../docs/architecture/OFF-001-Storage-Abstraction.md) for detailed design information.

## Dependencies

This module is the **ROOT DEPENDENCY** for the offline-first system. Other modules depend on it:

- **OFF-002** (Encryption Layer) - Provides encryption hooks
- **TXQ-001** (Transaction Queue) - Uses storage for queue persistence
- **AUTH-OFF-001** (Offline Auth) - Uses storage for session data
- **SYNC-001** (Sync Engine) - Uses storage for sync state

## Contributing

When contributing to this module:

1. Maintain backward compatibility with the interface
2. Add tests for all new features (maintain >90% coverage)
3. Update documentation for API changes
4. Follow TypeScript best practices
5. Ensure both IndexedDB and SQLite implementations stay in sync

## License

Internal use only - WebWaka Platform

---

**Module Version**: 1.0.0  
**Issue**: #34 (OFF-001)  
**Status**: Complete  
**Author**: webwakaagent1
