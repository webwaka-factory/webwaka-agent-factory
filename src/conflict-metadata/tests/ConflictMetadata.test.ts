/**
 * TXQ-003 — Conflict Metadata Comprehensive Tests
 * 
 * @module ConflictMetadata.test
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConflictMetadataTracker } from '../implementations/ConflictMetadataTracker';
import { ConflictType, ConflictResolution, MetadataValidationError } from '../interfaces/ConflictMetadata';
import { HashUtils } from '../utils/HashUtils';

describe('Conflict Metadata Tracker', () => {
  let tracker: ConflictMetadataTracker;
  let hashUtils: HashUtils;
  
  beforeEach(() => {
    tracker = new ConflictMetadataTracker();
    hashUtils = new HashUtils();
  });
  
  describe('Metadata Generation', () => {
    it('should generate metadata for new transaction', async () => {
      const metadata = await tracker.generateMetadata(
        'tx-1',
        { data: 'test' },
        'user-1',
        'device-1'
      );
      
      expect(metadata.version).toBe(1);
      expect(metadata.userId).toBe('user-1');
      expect(metadata.deviceId).toBe('device-1');
      expect(metadata.contentHash).toHaveLength(64); // SHA-256
      expect(metadata.serverTimestamp).toBeNull();
      expect(metadata.deviceTimestamp).toBeTruthy();
    });
    
    it('should include parent IDs in metadata', async () => {
      const metadata = await tracker.generateMetadata(
        'tx-2',
        { data: 'test' },
        'user-1',
        'device-1',
        ['tx-1']
      );
      
      expect(metadata.parentIds).toEqual(['tx-1']);
    });
    
    it('should generate different hashes for different content', async () => {
      const meta1 = await tracker.generateMetadata('tx-1', { data: 'test1' }, 'user-1', 'device-1');
      const meta2 = await tracker.generateMetadata('tx-2', { data: 'test2' }, 'user-1', 'device-1');
      
      expect(meta1.contentHash).not.toBe(meta2.contentHash);
    });
  });
  
  describe('Metadata Update', () => {
    it('should increment version on update', async () => {
      const original = await tracker.generateMetadata('tx-1', { data: 'v1' }, 'user-1', 'device-1');
      const updated = await tracker.updateMetadata(original, { data: 'v2' });
      
      expect(updated.version).toBe(2);
      expect(updated.contentHash).not.toBe(original.contentHash);
    });
    
    it('should preserve user and device IDs on update', async () => {
      const original = await tracker.generateMetadata('tx-1', { data: 'v1' }, 'user-1', 'device-1');
      const updated = await tracker.updateMetadata(original, { data: 'v2' });
      
      expect(updated.userId).toBe(original.userId);
      expect(updated.deviceId).toBe(original.deviceId);
    });
    
    it('should update lastModified timestamp', async () => {
      const original = await tracker.generateMetadata('tx-1', { data: 'v1' }, 'user-1', 'device-1');
      await new Promise(resolve => setTimeout(resolve, 10));
      const updated = await tracker.updateMetadata(original, { data: 'v2' });
      
      expect(new Date(updated.lastModified).getTime()).toBeGreaterThan(
        new Date(original.lastModified).getTime()
      );
    });
  });
  
  describe('Hash Computation', () => {
    it('should compute SHA-256 hash', async () => {
      const hash = await tracker.computeHash({ data: 'test' });
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
    
    it('should produce consistent hashes', async () => {
      const hash1 = await tracker.computeHash({ data: 'test' });
      const hash2 = await tracker.computeHash({ data: 'test' });
      expect(hash1).toBe(hash2);
    });
    
    it('should produce different hashes for different content', async () => {
      const hash1 = await tracker.computeHash({ data: 'test1' });
      const hash2 = await tracker.computeHash({ data: 'test2' });
      expect(hash1).not.toBe(hash2);
    });
  });
  
  describe('Metadata Validation', () => {
    it('should validate correct metadata', async () => {
      const metadata = await tracker.generateMetadata('tx-1', { data: 'test' }, 'user-1', 'device-1');
      expect(() => tracker.validateMetadata(metadata)).not.toThrow();
    });
    
    it('should reject invalid version', async () => {
      const metadata = await tracker.generateMetadata('tx-1', { data: 'test' }, 'user-1', 'device-1');
      metadata.version = 0;
      
      expect(() => tracker.validateMetadata(metadata)).toThrow(MetadataValidationError);
    });
    
    it('should reject missing device timestamp', async () => {
      const metadata = await tracker.generateMetadata('tx-1', { data: 'test' }, 'user-1', 'device-1');
      (metadata as any).deviceTimestamp = null;
      
      expect(() => tracker.validateMetadata(metadata)).toThrow(MetadataValidationError);
    });
    
    it('should reject invalid content hash', async () => {
      const metadata = await tracker.generateMetadata('tx-1', { data: 'test' }, 'user-1', 'device-1');
      metadata.contentHash = 'invalid';
      
      expect(() => tracker.validateMetadata(metadata)).toThrow(MetadataValidationError);
    });
    
    it('should reject missing user ID', async () => {
      const metadata = await tracker.generateMetadata('tx-1', { data: 'test' }, 'user-1', 'device-1');
      (metadata as any).userId = '';
      
      expect(() => tracker.validateMetadata(metadata)).toThrow(MetadataValidationError);
    });
  });
  
  describe('Conflict Detection', () => {
    it('should detect no conflict for identical metadata', async () => {
      const meta1 = await tracker.generateMetadata('tx-1', { data: 'test' }, 'user-1', 'device-1');
      const meta2 = { ...meta1 };
      
      const result = tracker.detectConflict(meta1, meta2);
      expect(result.hasConflict).toBe(false);
    });
    
    it('should detect version mismatch conflict', async () => {
      const meta1 = await tracker.generateMetadata('tx-1', { data: 'test' }, 'user-1', 'device-1');
      const meta2 = await tracker.updateMetadata(meta1, { data: 'test2' });
      
      const result = tracker.detectConflict(meta1, meta2);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe(ConflictType.VERSION_MISMATCH);
    });
    
    it('should detect hash mismatch conflict', async () => {
      const meta1 = await tracker.generateMetadata('tx-1', { data: 'test1' }, 'user-1', 'device-1');
      const meta2 = await tracker.generateMetadata('tx-1', { data: 'test2' }, 'user-1', 'device-1');
      
      const result = tracker.detectConflict(meta1, meta2);
      expect(result.hasConflict).toBe(true);
    });
    
    it('should detect concurrent modification', async () => {
      const meta1 = await tracker.generateMetadata('tx-1', { data: 'test1' }, 'user-1', 'device-1');
      const meta2 = await tracker.generateMetadata('tx-1', { data: 'test2' }, 'user-1', 'device-2');
      
      const result = tracker.detectConflict(meta1, meta2);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe(ConflictType.CONCURRENT_MODIFICATION);
    });
    
    it('should suggest last-write-wins resolution', async () => {
      const meta1 = await tracker.generateMetadata('tx-1', { data: 'test1' }, 'user-1', 'device-1');
      await new Promise(resolve => setTimeout(resolve, 10));
      const meta2 = await tracker.updateMetadata(meta1, { data: 'test2' });
      
      const result = tracker.detectConflict(meta1, meta2);
      expect(result.resolution).toBe(ConflictResolution.USE_REMOTE);
    });
  });
  
  describe('Hash Utils', () => {
    it('should verify correct hash', async () => {
      const content = 'test content';
      const hash = await hashUtils.sha256(content);
      const isValid = await hashUtils.verifyHash(content, hash);
      expect(isValid).toBe(true);
    });
    
    it('should reject incorrect hash', async () => {
      const content = 'test content';
      const wrongHash = await hashUtils.sha256('wrong content');
      const isValid = await hashUtils.verifyHash(content, wrongHash);
      expect(isValid).toBe(false);
    });
  });
});
