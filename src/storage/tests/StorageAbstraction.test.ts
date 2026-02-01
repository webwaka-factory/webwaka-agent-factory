/**
 * OFF-001 — Storage Abstraction Unit Tests
 * 
 * Comprehensive test suite for storage abstraction interface
 * Tests both IndexedDB and SQLite implementations
 * 
 * @module StorageAbstraction.test
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  IStorageAbstraction,
  StorageEntity,
  StorageError,
  StorageErrorCode
} from '../interfaces/StorageAbstraction';
import { IndexedDBStorage } from '../implementations/IndexedDBStorage';
import { SQLiteStorage } from '../implementations/SQLiteStorage';

/**
 * Test data interfaces
 */
interface TestUser {
  name: string;
  email: string;
  age: number;
}

interface TestProduct {
  title: string;
  price: number;
  inStock: boolean;
}

/**
 * Generic test suite for storage implementations
 */
function createStorageTestSuite(
  name: string,
  createStorage: () => IStorageAbstraction
) {
  describe(`${name} Storage Implementation`, () => {
    let storage: IStorageAbstraction;
    
    beforeEach(async () => {
      storage = createStorage();
      await storage.initialize({ debug: false });
    });
    
    afterEach(async () => {
      await storage.clearAll();
      await storage.close();
    });
    
    describe('Initialization', () => {
      it('should initialize successfully', async () => {
        const newStorage = createStorage();
        await expect(newStorage.initialize()).resolves.not.toThrow();
        await newStorage.close();
      });
      
      it('should allow multiple initializations', async () => {
        await expect(storage.initialize()).resolves.not.toThrow();
        await expect(storage.initialize()).resolves.not.toThrow();
      });
      
      it('should throw error when accessing uninitialized storage', async () => {
        const newStorage = createStorage();
        await expect(
          newStorage.get('users', 'user1')
        ).rejects.toThrow(StorageError);
      });
    });
    
    describe('CRUD Operations', () => {
      describe('set() and get()', () => {
        it('should store and retrieve an entity', async () => {
          const user: TestUser = {
            name: 'John Doe',
            email: 'john@example.com',
            age: 30
          };
          
          const stored = await storage.set('users', 'user1', user);
          
          expect(stored.data).toEqual(user);
          expect(stored.metadata.id).toBe('user1');
          expect(stored.metadata.version).toBe(1);
          expect(stored.metadata.synced).toBe(false);
          
          const retrieved = await storage.get<TestUser>('users', 'user1');
          
          expect(retrieved).not.toBeNull();
          expect(retrieved!.data).toEqual(user);
          expect(retrieved!.metadata.id).toBe('user1');
        });
        
        it('should return null for non-existent entity', async () => {
          const result = await storage.get('users', 'nonexistent');
          expect(result).toBeNull();
        });
        
        it('should update existing entity', async () => {
          const user: TestUser = {
            name: 'John Doe',
            email: 'john@example.com',
            age: 30
          };
          
          await storage.set('users', 'user1', user);
          
          const updated: TestUser = {
            name: 'John Doe',
            email: 'john.doe@example.com',
            age: 31
          };
          
          const result = await storage.set('users', 'user1', updated);
          
          expect(result.data).toEqual(updated);
          expect(result.metadata.version).toBe(2);
          
          const retrieved = await storage.get<TestUser>('users', 'user1');
          expect(retrieved!.data.age).toBe(31);
        });
        
        it('should merge data when merge option is true', async () => {
          const user: TestUser = {
            name: 'John Doe',
            email: 'john@example.com',
            age: 30
          };
          
          await storage.set('users', 'user1', user);
          
          const partial = { age: 31 };
          await storage.set('users', 'user1', partial, { merge: true });
          
          const retrieved = await storage.get<TestUser>('users', 'user1');
          
          expect(retrieved!.data.name).toBe('John Doe');
          expect(retrieved!.data.email).toBe('john@example.com');
          expect(retrieved!.data.age).toBe(31);
        });
        
        it('should track metadata correctly', async () => {
          const user: TestUser = {
            name: 'John Doe',
            email: 'john@example.com',
            age: 30
          };
          
          const stored = await storage.set('users', 'user1', user);
          
          expect(stored.metadata.createdAt).toBeDefined();
          expect(stored.metadata.updatedAt).toBeDefined();
          expect(stored.metadata.hash).toBeDefined();
          expect(stored.metadata.version).toBe(1);
          expect(stored.metadata.synced).toBe(false);
          expect(stored.metadata.lastSyncedAt).toBeNull();
        });
        
        it('should mark as synced when option is set', async () => {
          const user: TestUser = {
            name: 'John Doe',
            email: 'john@example.com',
            age: 30
          };
          
          const stored = await storage.set('users', 'user1', user, { synced: true });
          
          expect(stored.metadata.synced).toBe(true);
          expect(stored.metadata.lastSyncedAt).not.toBeNull();
        });
      });
      
      describe('delete()', () => {
        it('should delete an existing entity', async () => {
          const user: TestUser = {
            name: 'John Doe',
            email: 'john@example.com',
            age: 30
          };
          
          await storage.set('users', 'user1', user);
          
          const result = await storage.delete('users', 'user1');
          
          expect(result.deleted).toBe(true);
          expect(result.id).toBe('user1');
          
          const retrieved = await storage.get('users', 'user1');
          expect(retrieved).toBeNull();
        });
        
        it('should return false for non-existent entity', async () => {
          const result = await storage.delete('users', 'nonexistent');
          expect(result.deleted).toBe(false);
        });
      });
      
      describe('clear()', () => {
        it('should clear all entities in a collection', async () => {
          await storage.set('users', 'user1', { name: 'User 1' });
          await storage.set('users', 'user2', { name: 'User 2' });
          await storage.set('users', 'user3', { name: 'User 3' });
          
          const count = await storage.clear('users');
          
          expect(count).toBe(3);
          
          const result = await storage.query('users');
          expect(result.totalCount).toBe(0);
        });
        
        it('should not affect other collections', async () => {
          await storage.set('users', 'user1', { name: 'User 1' });
          await storage.set('products', 'prod1', { title: 'Product 1' });
          
          await storage.clear('users');
          
          const usersResult = await storage.query('users');
          const productsResult = await storage.query('products');
          
          expect(usersResult.totalCount).toBe(0);
          expect(productsResult.totalCount).toBe(1);
        });
      });
      
      describe('clearAll()', () => {
        it('should clear all data across all collections', async () => {
          await storage.set('users', 'user1', { name: 'User 1' });
          await storage.set('users', 'user2', { name: 'User 2' });
          await storage.set('products', 'prod1', { title: 'Product 1' });
          
          const count = await storage.clearAll();
          
          expect(count).toBe(3);
          
          const usersResult = await storage.query('users');
          const productsResult = await storage.query('products');
          
          expect(usersResult.totalCount).toBe(0);
          expect(productsResult.totalCount).toBe(0);
        });
      });
    });
    
    describe('Query Operations', () => {
      beforeEach(async () => {
        // Seed test data
        await storage.set('users', 'user1', {
          name: 'Alice',
          email: 'alice@example.com',
          age: 25
        });
        await storage.set('users', 'user2', {
          name: 'Bob',
          email: 'bob@example.com',
          age: 30
        });
        await storage.set('users', 'user3', {
          name: 'Charlie',
          email: 'charlie@example.com',
          age: 35
        });
        await storage.set('users', 'user4', {
          name: 'David',
          email: 'david@example.com',
          age: 40
        });
      });
      
      it('should query all entities', async () => {
        const result = await storage.query('users');
        
        expect(result.totalCount).toBe(4);
        expect(result.entities.length).toBe(4);
        expect(result.hasMore).toBe(false);
      });
      
      it('should filter by equality condition', async () => {
        const result = await storage.query<TestUser>('users', {
          conditions: [
            { field: 'data.name', operator: 'eq', value: 'Bob' }
          ]
        });
        
        expect(result.totalCount).toBe(1);
        expect(result.entities[0].data.name).toBe('Bob');
      });
      
      it('should filter by greater than condition', async () => {
        const result = await storage.query<TestUser>('users', {
          conditions: [
            { field: 'data.age', operator: 'gt', value: 30 }
          ]
        });
        
        expect(result.totalCount).toBe(2);
        expect(result.entities.every(e => e.data.age > 30)).toBe(true);
      });
      
      it('should filter by multiple conditions (AND logic)', async () => {
        const result = await storage.query<TestUser>('users', {
          conditions: [
            { field: 'data.age', operator: 'gte', value: 30 },
            { field: 'data.age', operator: 'lte', value: 35 }
          ]
        });
        
        expect(result.totalCount).toBe(2);
      });
      
      it('should sort results ascending', async () => {
        const result = await storage.query<TestUser>('users', {
          sort: [{ field: 'data.age', direction: 'asc' }]
        });
        
        expect(result.entities[0].data.age).toBe(25);
        expect(result.entities[3].data.age).toBe(40);
      });
      
      it('should sort results descending', async () => {
        const result = await storage.query<TestUser>('users', {
          sort: [{ field: 'data.age', direction: 'desc' }]
        });
        
        expect(result.entities[0].data.age).toBe(40);
        expect(result.entities[3].data.age).toBe(25);
      });
      
      it('should paginate results with limit', async () => {
        const result = await storage.query('users', {
          limit: 2
        });
        
        expect(result.entities.length).toBe(2);
        expect(result.totalCount).toBe(4);
        expect(result.hasMore).toBe(true);
      });
      
      it('should paginate results with offset', async () => {
        const result = await storage.query('users', {
          limit: 2,
          offset: 2
        });
        
        expect(result.entities.length).toBe(2);
        expect(result.totalCount).toBe(4);
        expect(result.hasMore).toBe(false);
      });
      
      it('should combine filtering, sorting, and pagination', async () => {
        const result = await storage.query<TestUser>('users', {
          conditions: [
            { field: 'data.age', operator: 'gte', value: 30 }
          ],
          sort: [{ field: 'data.age', direction: 'asc' }],
          limit: 2
        });
        
        expect(result.entities.length).toBe(2);
        expect(result.totalCount).toBe(3);
        expect(result.entities[0].data.age).toBe(30);
      });
    });
    
    describe('Storage Statistics', () => {
      it('should return accurate statistics', async () => {
        await storage.set('users', 'user1', { name: 'User 1' });
        await storage.set('users', 'user2', { name: 'User 2' }, { synced: true });
        await storage.set('products', 'prod1', { title: 'Product 1' });
        
        const stats = await storage.getStats();
        
        expect(stats.entityCount).toBe(3);
        expect(stats.unsyncedCount).toBe(2);
        expect(stats.backend).toBe(name);
      });
    });
    
    describe('Data Persistence', () => {
      it('should persist data after close and reopen', async () => {
        const user: TestUser = {
          name: 'John Doe',
          email: 'john@example.com',
          age: 30
        };
        
        await storage.set('users', 'user1', user);
        await storage.close();
        
        // Reopen storage
        storage = createStorage();
        await storage.initialize();
        
        const retrieved = await storage.get<TestUser>('users', 'user1');
        
        expect(retrieved).not.toBeNull();
        expect(retrieved!.data).toEqual(user);
      });
    });
    
    describe('Concurrent Operations', () => {
      it('should handle concurrent writes', async () => {
        const promises = [];
        
        for (let i = 0; i < 10; i++) {
          promises.push(
            storage.set(`users`, `user${i}`, {
              name: `User ${i}`,
              email: `user${i}@example.com`,
              age: 20 + i
            })
          );
        }
        
        await Promise.all(promises);
        
        const result = await storage.query('users');
        expect(result.totalCount).toBe(10);
      });
      
      it('should handle concurrent reads', async () => {
        await storage.set('users', 'user1', { name: 'User 1' });
        
        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(storage.get('users', 'user1'));
        }
        
        const results = await Promise.all(promises);
        
        expect(results.every(r => r !== null)).toBe(true);
      });
    });
    
    describe('Error Handling', () => {
      it('should throw StorageError with appropriate code', async () => {
        const newStorage = createStorage();
        
        try {
          await newStorage.get('users', 'user1');
          fail('Should have thrown StorageError');
        } catch (error) {
          expect(error).toBeInstanceOf(StorageError);
          expect((error as StorageError).code).toBe(StorageErrorCode.NOT_INITIALIZED);
        }
      });
    });
    
    describe('Encryption Hook Integration', () => {
      it('should support encryption hook', async () => {
        const mockEncryptionHook = {
          encrypt: async (data: any) => {
            return JSON.stringify({ encrypted: true, data });
          },
          decrypt: async (encryptedData: string) => {
            const parsed = JSON.parse(encryptedData);
            return parsed.data;
          }
        };
        
        storage.setEncryptionHook(mockEncryptionHook);
        
        const user: TestUser = {
          name: 'John Doe',
          email: 'john@example.com',
          age: 30
        };
        
        await storage.set('users', 'user1', user);
        const retrieved = await storage.get<TestUser>('users', 'user1');
        
        expect(retrieved!.data).toEqual(user);
      });
    });
  });
}

// Run test suites for both implementations
createStorageTestSuite('IndexedDB', () => new IndexedDBStorage());
createStorageTestSuite('SQLite', () => new SQLiteStorage());

// Additional integration tests
describe('Storage Abstraction Integration', () => {
  it('should allow swapping backends without breaking code', async () => {
    const testWithBackend = async (storage: IStorageAbstraction) => {
      await storage.initialize();
      
      await storage.set('users', 'user1', { name: 'Test User' });
      const retrieved = await storage.get('users', 'user1');
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.data.name).toBe('Test User');
      
      await storage.close();
    };
    
    await testWithBackend(new IndexedDBStorage());
    await testWithBackend(new SQLiteStorage());
  });
});
