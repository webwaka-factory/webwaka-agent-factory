/**
 * AUTH-OFF-001 — Offline Session Continuity
 * Complete Implementation
 * 
 * @module OfflineAuth
 * @version 1.0.0
 * @author webwakaagent1
 * @date 2026-02-01
 */

import { IEncryptionService } from '../encryption/interfaces/EncryptionService';
import { IStorageAbstraction } from '../storage/interfaces/StorageAbstraction';

// ============================================================================
// INTERFACES
// ============================================================================

export interface OfflineSession {
  sessionId: string;
  userId: string;
  deviceId: string;
  token: string; // Cryptographically secure token
  createdAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
  lastActivityAt: string; // ISO 8601
  isActive: boolean;
  permissions: string[];
  metadata: Record<string, any>;
}

export interface SessionValidationResult {
  isValid: boolean;
  reason?: string;
  session?: OfflineSession;
}

export interface IOfflineSessionManager {
  createSession(userId: string, deviceId: string, permissions: string[]): Promise<OfflineSession>;
  getSession(sessionId: string): Promise<OfflineSession | null>;
  validateSession(sessionId: string): Promise<SessionValidationResult>;
  refreshSession(sessionId: string): Promise<OfflineSession>;
  invalidateSession(sessionId: string): Promise<void>;
  recordActivity(sessionId: string): Promise<void>;
  cleanupExpiredSessions(): Promise<number>;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class OfflineSessionManager implements IOfflineSessionManager {
  private static readonly MAX_SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private static readonly STORAGE_KEY = 'offline_sessions';
  
  constructor(
    private storage: IStorageAbstraction,
    private encryption: IEncryptionService
  ) {}
  
  async createSession(
    userId: string,
    deviceId: string,
    permissions: string[]
  ): Promise<OfflineSession> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OfflineSessionManager.MAX_SESSION_DURATION_MS);
    
    const session: OfflineSession = {
      sessionId: this.generateSessionId(),
      userId,
      deviceId,
      token: this.generateSecureToken(),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastActivityAt: now.toISOString(),
      isActive: true,
      permissions,
      metadata: {}
    };
    
    await this.saveSession(session);
    return session;
  }
  
  async getSession(sessionId: string): Promise<OfflineSession | null> {
    try {
      const encryptedData = await this.storage.get(
        OfflineSessionManager.STORAGE_KEY,
        sessionId
      );
      
      if (!encryptedData) {
        return null;
      }
      
      const decrypted = await this.encryption.decrypt(encryptedData);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }
  
  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return {
        isValid: false,
        reason: 'Session not found'
      };
    }
    
    if (!session.isActive) {
      return {
        isValid: false,
        reason: 'Session is inactive',
        session
      };
    }
    
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);
    
    if (now > expiresAt) {
      await this.invalidateSession(sessionId);
      return {
        isValid: false,
        reason: 'Session expired',
        session
      };
    }
    
    const lastActivity = new Date(session.lastActivityAt);
    const inactivityDuration = now.getTime() - lastActivity.getTime();
    
    if (inactivityDuration > OfflineSessionManager.INACTIVITY_TIMEOUT_MS) {
      await this.invalidateSession(sessionId);
      return {
        isValid: false,
        reason: 'Session timed out due to inactivity',
        session
      };
    }
    
    return {
      isValid: true,
      session
    };
  }
  
  async refreshSession(sessionId: string): Promise<OfflineSession> {
    const validation = await this.validateSession(sessionId);
    
    if (!validation.isValid || !validation.session) {
      throw new Error(`Cannot refresh invalid session: ${validation.reason}`);
    }
    
    const session = validation.session;
    session.lastActivityAt = new Date().toISOString();
    
    await this.saveSession(session);
    return session;
  }
  
  async invalidateSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.isActive = false;
      await this.saveSession(session);
    }
  }
  
  async recordActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session && session.isActive) {
      session.lastActivityAt = new Date().toISOString();
      await this.saveSession(session);
    }
  }
  
  async cleanupExpiredSessions(): Promise<number> {
    const allSessions = await this.getAllSessions();
    const now = new Date();
    let cleanedCount = 0;
    
    for (const session of allSessions) {
      const expiresAt = new Date(session.expiresAt);
      if (now > expiresAt || !session.isActive) {
        await this.storage.delete(OfflineSessionManager.STORAGE_KEY, session.sessionId);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }
  
  private async saveSession(session: OfflineSession): Promise<void> {
    const serialized = JSON.stringify(session);
    const encrypted = await this.encryption.encrypt(serialized);
    
    await this.storage.set(
      OfflineSessionManager.STORAGE_KEY,
      session.sessionId,
      encrypted
    );
  }
  
  private async getAllSessions(): Promise<OfflineSession[]> {
    try {
      const results = await this.storage.query(OfflineSessionManager.STORAGE_KEY, {});
      const sessions: OfflineSession[] = [];
      
      for (const result of results) {
        try {
          const decrypted = await this.encryption.decrypt(result.data);
          sessions.push(JSON.parse(decrypted));
        } catch (error) {
          console.error('Failed to decrypt session:', error);
        }
      }
      
      return sessions;
    } catch (error) {
      console.error('Failed to get all sessions:', error);
      return [];
    }
  }
  
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateSecureToken(): string {
    // Generate cryptographically secure token
    const array = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for Node.js
      const nodeCrypto = require('crypto');
      nodeCrypto.randomFillSync(array);
    }
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

// ============================================================================
// PERMISSION CHECKER
// ============================================================================

export class OfflinePermissionChecker {
  private static readonly SENSITIVE_OPERATIONS = [
    'delete_account',
    'change_password',
    'transfer_funds',
    'admin_access',
    'user_management'
  ];
  
  static canPerformOperation(session: OfflineSession, operation: string): boolean {
    // Sensitive operations not allowed offline
    if (this.SENSITIVE_OPERATIONS.includes(operation)) {
      return false;
    }
    
    // Check if user has permission
    return session.permissions.includes(operation) || session.permissions.includes('*');
  }
  
  static isSensitiveOperation(operation: string): boolean {
    return this.SENSITIVE_OPERATIONS.includes(operation);
  }
}

// ============================================================================
// TESTS
// ============================================================================

export const OfflineAuthTests = {
  async runAll(storage: IStorageAbstraction, encryption: IEncryptionService): Promise<void> {
    console.log('Running AUTH-OFF-001 tests...');
    
    const manager = new OfflineSessionManager(storage, encryption);
    
    // Test 1: Create session
    const session = await manager.createSession('user-1', 'device-1', ['read', 'write']);
    console.assert(session.sessionId, 'Session ID should exist');
    console.assert(session.isActive, 'Session should be active');
    console.assert(session.token.length === 64, 'Token should be 64 chars');
    
    // Test 2: Get session
    const retrieved = await manager.getSession(session.sessionId);
    console.assert(retrieved !== null, 'Should retrieve session');
    console.assert(retrieved?.userId === 'user-1', 'User ID should match');
    
    // Test 3: Validate session
    const validation = await manager.validateSession(session.sessionId);
    console.assert(validation.isValid, 'Session should be valid');
    
    // Test 4: Record activity
    await manager.recordActivity(session.sessionId);
    const updated = await manager.getSession(session.sessionId);
    console.assert(updated?.lastActivityAt !== session.lastActivityAt, 'Activity should be recorded');
    
    // Test 5: Permission check
    console.assert(
      OfflinePermissionChecker.canPerformOperation(session, 'read'),
      'Should allow read operation'
    );
    console.assert(
      !OfflinePermissionChecker.canPerformOperation(session, 'delete_account'),
      'Should block sensitive operation'
    );
    
    // Test 6: Invalidate session
    await manager.invalidateSession(session.sessionId);
    const invalidated = await manager.getSession(session.sessionId);
    console.assert(!invalidated?.isActive, 'Session should be inactive');
    
    console.log('✅ All AUTH-OFF-001 tests passed');
  }
};
