/**
 * SYNC-001 — Network Detection Unit Tests
 * 
 * Tests for network reconnection detection with state machine and debouncing.
 * 
 * @module NetworkDetection.test
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  INetworkDetection,
  NetworkState,
  NetworkEventType,
  NetworkDetectionError
} from '../interfaces/NetworkDetection';
import { NetworkDetector } from '../implementations/NetworkDetector';

describe('Network Detection', () => {
  let detector: INetworkDetection;
  
  const testConfig = {
    healthEndpoint: 'https://example.com/health',
    debounceDuration: 100, // Shorter for testing
    retryAttempts: 2,
    retryBackoff: 50,
    pingTimeout: 1000,
    debug: false
  };
  
  beforeEach(async () => {
    detector = new NetworkDetector();
  });
  
  afterEach(async () => {
    if (detector.isMonitoring()) {
      await detector.stop();
    }
    await detector.close();
  });
  
  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(detector.initialize(testConfig)).resolves.not.toThrow();
      expect(detector.isInitialized()).toBe(true);
    });
    
    it('should detect initial state', async () => {
      await detector.initialize(testConfig);
      const state = detector.getState();
      expect([NetworkState.ONLINE, NetworkState.OFFLINE]).toContain(state);
    });
    
    it('should throw error for invalid config', async () => {
      await expect(
        detector.initialize({ healthEndpoint: '' } as any)
      ).rejects.toThrow(NetworkDetectionError);
    });
  });
  
  describe('Monitoring', () => {
    beforeEach(async () => {
      await detector.initialize(testConfig);
    });
    
    it('should start monitoring', async () => {
      await detector.start();
      expect(detector.isMonitoring()).toBe(true);
    });
    
    it('should stop monitoring', async () => {
      await detector.start();
      await detector.stop();
      expect(detector.isMonitoring()).toBe(false);
    });
  });
  
  describe('State Management', () => {
    beforeEach(async () => {
      await detector.initialize(testConfig);
    });
    
    it('should return current state', () => {
      const state = detector.getState();
      expect(Object.values(NetworkState)).toContain(state);
    });
    
    it('should check if online', () => {
      const isOnline = detector.isOnline();
      expect(typeof isOnline).toBe('boolean');
    });
    
    it('should check if offline', () => {
      const isOffline = detector.isOffline();
      expect(typeof isOffline).toBe('boolean');
    });
  });
  
  describe('Connectivity Check', () => {
    beforeEach(async () => {
      await detector.initialize(testConfig);
    });
    
    it('should check connectivity', async () => {
      const isOnline = await detector.checkConnectivity();
      expect(typeof isOnline).toBe('boolean');
    });
  });
  
  describe('Event Listeners', () => {
    beforeEach(async () => {
      await detector.initialize(testConfig);
    });
    
    it('should add event listener', () => {
      const listener = jest.fn();
      expect(() => detector.on(NetworkEventType.ONLINE, listener)).not.toThrow();
    });
    
    it('should remove event listener', () => {
      const listener = jest.fn();
      detector.on(NetworkEventType.ONLINE, listener);
      expect(() => detector.off(NetworkEventType.ONLINE, listener)).not.toThrow();
    });
  });
  
  describe('Statistics', () => {
    beforeEach(async () => {
      await detector.initialize(testConfig);
    });
    
    it('should return statistics', () => {
      const stats = detector.getStats();
      
      expect(stats).toHaveProperty('currentState');
      expect(stats).toHaveProperty('stateChangeCount');
      expect(stats).toHaveProperty('pingAttemptCount');
      expect(stats).toHaveProperty('uptimePercentage');
    });
  });
});
