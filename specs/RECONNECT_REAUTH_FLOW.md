# WebWaka Reconnect Re-Authentication Flow

**Version:** 1.0  
**Last Updated:** February 1, 2026  
**Issue:** #42 (AUTH-OFF-003)

---

## Table of Contents

1. [Overview](#overview)
2. [Reconnect Flow Design](#reconnect-flow-design)
3. [Network Detection](#network-detection)
4. [Re-Authentication Request](#re-authentication-request)
5. [Session Validation](#session-validation)
6. [Invalidation Handling](#invalidation-handling)
7. [User Feedback](#user-feedback)
8. [Implementation Guide](#implementation-guide)
9. [API Specification](#api-specification)
10. [Security Considerations](#security-considerations)

---

## Overview

When a user reconnects to the internet after being offline, WebWaka performs mandatory server re-authentication to validate the offline session. This ensures that:

1. **Sessions haven't been revoked** - Admin can revoke sessions remotely
2. **Credentials haven't changed** - Password changes invalidate old sessions
3. **Security policies are enforced** - Session duration, device limits, etc.
4. **Pending changes can sync** - Valid session required for sync

### Core Principles

1. **Mandatory validation** - All reconnects trigger re-auth
2. **Transparent to user** - Happens automatically in background
3. **Graceful degradation** - Invalid sessions handled smoothly
4. **Clear communication** - User understands why re-login is needed
5. **Preserve pending changes** - Never lose offline work

---

## Reconnect Flow Design

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User Goes Offline                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   User Works Offline                         │
│  - Create/update/delete entities                            │
│  - Changes queued in transaction queue                      │
│  - Session remains valid locally (up to 24 hours)           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Network Connectivity Restored                   │
│  - Network detection triggers reconnect event               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          Validate Session with Server (Re-Auth)              │
│  POST /auth/validate-session                                │
│  { sessionToken, deviceId, metadata }                       │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
    ┌───────────────────┐   ┌───────────────────┐
    │  Session Valid    │   │  Session Invalid  │
    │  { valid: true }  │   │  { valid: false } │
    └───────────────────┘   └───────────────────┘
                │                       │
                ▼                       ▼
    ┌───────────────────┐   ┌───────────────────┐
    │  Update Token     │   │  Clear Session    │
    │  Begin Sync       │   │  Show Re-Login    │
    │  Show Success     │   │  Preserve Queue   │
    └───────────────────┘   └───────────────────┘
```

### State Machine

```typescript
enum ReconnectState {
  OFFLINE = 'offline',
  DETECTING = 'detecting',
  VALIDATING = 'validating',
  VALID = 'valid',
  INVALID = 'invalid',
  SYNCING = 'syncing',
  COMPLETE = 'complete',
  ERROR = 'error'
}

interface ReconnectContext {
  state: ReconnectState;
  sessionToken: string;
  deviceId: string;
  offlineDuration: number;
  pendingTransactions: number;
  validationAttempts: number;
  error?: Error;
}
```

---

## Network Detection

### Network Event Subscription

```typescript
class NetworkDetector {
  private listeners: Set<NetworkListener> = new Set();
  private isOnline: boolean = navigator.onLine;
  
  constructor() {
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    // Browser online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Periodic connectivity check (every 30 seconds)
    setInterval(() => this.checkConnectivity(), 30000);
  }
  
  private async handleOnline(): Promise<void> {
    console.log('Network: Online event detected');
    
    // Verify connectivity with ping
    const isReallyOnline = await this.verifyConnectivity();
    
    if (isReallyOnline && !this.isOnline) {
      this.isOnline = true;
      this.notifyListeners('online');
    }
  }
  
  private handleOffline(): void {
    console.log('Network: Offline event detected');
    this.isOnline = false;
    this.notifyListeners('offline');
  }
  
  private async verifyConnectivity(): Promise<boolean> {
    try {
      // Ping server health endpoint
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        timeout: 5000
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }
  
  private async checkConnectivity(): Promise<void> {
    const isOnline = await this.verifyConnectivity();
    
    if (isOnline !== this.isOnline) {
      this.isOnline = isOnline;
      this.notifyListeners(isOnline ? 'online' : 'offline');
    }
  }
  
  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(event: 'online' | 'offline'): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
  
  getStatus(): boolean {
    return this.isOnline;
  }
}
```

### Integration with Reconnect Flow

```typescript
class ReconnectManager {
  private networkDetector: NetworkDetector;
  private sessionManager: SessionManager;
  
  constructor() {
    this.networkDetector = new NetworkDetector();
    this.sessionManager = new SessionManager();
    
    // Subscribe to network events
    this.networkDetector.subscribe(event => {
      if (event === 'online') {
        this.handleReconnect();
      }
    });
  }
  
  private async handleReconnect(): Promise<void> {
    console.log('Reconnect: Starting re-authentication flow');
    
    // Get current session
    const session = await this.sessionManager.getSession();
    
    if (!session) {
      console.log('Reconnect: No session found, skipping re-auth');
      return;
    }
    
    // Validate session with server
    await this.validateSession(session);
  }
}
```

---

## Re-Authentication Request

### Request Implementation

```typescript
interface ReAuthRequest {
  sessionToken: string;
  deviceId: string;
  metadata: {
    offlineDuration: number;
    lastActivity: number;
    appVersion: string;
    platform: string;
  };
}

interface ReAuthResponse {
  valid: boolean;
  reason?: string;
  newToken?: string;
  expiresAt?: number;
}

async function sendReAuthRequest(
  session: Session
): Promise<ReAuthResponse> {
  const offlineDuration = Date.now() - session.lastOnlineAt;
  
  const request: ReAuthRequest = {
    sessionToken: session.token,
    deviceId: session.deviceId,
    metadata: {
      offlineDuration,
      lastActivity: session.lastActivity,
      appVersion: getAppVersion(),
      platform: getPlatform()
    }
  };
  
  try {
    const response = await fetch('/api/auth/validate-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify(request),
      timeout: 10000 // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`Re-auth failed: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Re-auth request failed:', error);
    throw error;
  }
}
```

### Retry Logic

```typescript
async function sendReAuthRequestWithRetry(
  session: Session,
  maxRetries: number = 3
): Promise<ReAuthResponse> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Re-auth attempt ${attempt}/${maxRetries}`);
      return await sendReAuthRequest(session);
      
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`Re-auth failed, retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}
```

---

## Session Validation

### Validation Logic

```typescript
class SessionValidator {
  async validateSession(session: Session): Promise<ValidationResult> {
    // Step 1: Check local expiration
    if (this.isExpiredLocally(session)) {
      return {
        valid: false,
        reason: 'session_expired_locally',
        requiresReLogin: true
      };
    }
    
    // Step 2: Send re-auth request to server
    try {
      const response = await sendReAuthRequestWithRetry(session);
      
      if (response.valid) {
        // Session is valid
        return {
          valid: true,
          newToken: response.newToken,
          expiresAt: response.expiresAt
        };
      } else {
        // Session is invalid on server
        return {
          valid: false,
          reason: response.reason || 'session_invalid',
          requiresReLogin: true
        };
      }
      
    } catch (error) {
      // Network error during validation
      return {
        valid: false,
        reason: 'validation_failed',
        requiresReLogin: false, // Don't force re-login on network error
        error
      };
    }
  }
  
  private isExpiredLocally(session: Session): boolean {
    const now = Date.now();
    const maxOfflineDuration = 24 * 60 * 60 * 1000; // 24 hours
    
    // Check absolute expiration
    if (now > session.expiresAt) {
      return true;
    }
    
    // Check offline duration
    const offlineDuration = now - session.lastOnlineAt;
    if (offlineDuration > maxOfflineDuration) {
      return true;
    }
    
    return false;
  }
}
```

### Validation Result Handling

```typescript
async function handleValidationResult(
  result: ValidationResult,
  session: Session
): Promise<void> {
  if (result.valid) {
    // Session is valid
    console.log('Session validated successfully');
    
    // Update session with new token (if provided)
    if (result.newToken) {
      session.token = result.newToken;
      session.expiresAt = result.expiresAt;
      await sessionManager.saveSession(session);
    }
    
    // Update last online timestamp
    session.lastOnlineAt = Date.now();
    await sessionManager.saveSession(session);
    
    // Show success message
    showNotification('Connected', 'success');
    
    // Trigger sync
    await syncEngine.sync();
    
  } else {
    // Session is invalid
    console.log(`Session invalid: ${result.reason}`);
    
    if (result.requiresReLogin) {
      // Clear session and show re-login
      await handleInvalidSession(result.reason);
    } else {
      // Validation failed but don't force re-login (e.g., network error)
      showNotification('Connection issue, retrying...', 'warning');
    }
  }
}
```

---

## Invalidation Handling

### Clear Session

```typescript
async function handleInvalidSession(reason: string): Promise<void> {
  console.log(`Handling invalid session: ${reason}`);
  
  // Step 1: Get pending transactions count
  const pendingCount = await transactionQueue.getPendingCount();
  
  // Step 2: Clear session (but preserve pending changes)
  await sessionManager.clearSession();
  
  // Step 3: Show user-friendly message
  const message = getInvalidSessionMessage(reason, pendingCount);
  showReLoginDialog(message, pendingCount);
}

function getInvalidSessionMessage(
  reason: string,
  pendingCount: number
): string {
  const baseMessage = {
    'session_expired_locally': 'Your session expired after 24 hours offline.',
    'session_revoked': 'Your session was revoked. This may happen if you logged in on another device or your password was changed.',
    'session_invalid': 'Your session is no longer valid.',
    'password_changed': 'Your password was changed. Please log in again.',
    'account_disabled': 'Your account has been disabled. Please contact support.',
    'device_removed': 'This device was removed from your account.'
  }[reason] || 'Your session is no longer valid.';
  
  if (pendingCount > 0) {
    return `${baseMessage}\n\nYou have ${pendingCount} pending changes that will sync after you log in.`;
  }
  
  return baseMessage;
}
```

### Re-Login Dialog

```typescript
interface ReLoginDialogProps {
  message: string;
  pendingCount: number;
  onLogin: (credentials: Credentials) => Promise<void>;
}

function ReLoginDialog({ message, pendingCount, onLogin }: ReLoginDialogProps) {
  const [credentials, setCredentials] = useState<Credentials>({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await onLogin(credentials);
      // Success - dialog will close automatically
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog title="Session Expired" closeable={false}>
      <Message type="info">{message}</Message>
      
      {pendingCount > 0 && (
        <Alert type="warning">
          <strong>Don't worry!</strong> Your {pendingCount} offline changes are safe and will sync after you log in.
        </Alert>
      )}
      
      <Form onSubmit={handleSubmit}>
        <Input
          label="Username"
          value={credentials.username}
          onChange={v => setCredentials({ ...credentials, username: v })}
          required
        />
        <Input
          label="Password"
          type="password"
          value={credentials.password}
          onChange={v => setCredentials({ ...credentials, password: v })}
          required
        />
        
        {error && <Alert type="error">{error}</Alert>}
        
        <Button type="submit" loading={loading}>
          Log In
        </Button>
      </Form>
    </Dialog>
  );
}
```

### Preserve Pending Changes

```typescript
async function ensurePendingChangesPreserved(): Promise<void> {
  // Verify transaction queue is intact
  const pending = await transactionQueue.getPending();
  console.log(`Preserved ${pending.length} pending transactions`);
  
  // Verify local store is intact
  const entities = await localStore.getAllEntities();
  console.log(`Preserved ${entities.length} local entities`);
  
  // Mark all pending transactions for sync after re-login
  for (const transaction of pending) {
    transaction.requiresAuth = true;
    await transactionQueue.update(transaction);
  }
}
```

---

## User Feedback

### Status Indicators

```typescript
enum ReconnectStatus {
  OFFLINE = 'offline',
  RECONNECTING = 'reconnecting',
  VALIDATING = 'validating',
  SYNCING = 'syncing',
  ONLINE = 'online',
  ERROR = 'error'
}

interface StatusIndicatorProps {
  status: ReconnectStatus;
  pendingCount?: number;
}

function StatusIndicator({ status, pendingCount }: StatusIndicatorProps) {
  const config = {
    offline: {
      icon: '🔴',
      text: 'Offline',
      color: 'red'
    },
    reconnecting: {
      icon: '🟡',
      text: 'Reconnecting...',
      color: 'yellow',
      animated: true
    },
    validating: {
      icon: '🟡',
      text: 'Validating session...',
      color: 'yellow',
      animated: true
    },
    syncing: {
      icon: '🟡',
      text: `Syncing ${pendingCount || 0} changes...`,
      color: 'yellow',
      animated: true
    },
    online: {
      icon: '🟢',
      text: 'Online',
      color: 'green'
    },
    error: {
      icon: '⚠️',
      text: 'Connection error',
      color: 'orange'
    }
  }[status];
  
  return (
    <StatusBadge color={config.color} animated={config.animated}>
      <span>{config.icon}</span>
      <span>{config.text}</span>
    </StatusBadge>
  );
}
```

### Notification Messages

```typescript
interface ReconnectNotification {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

function showReconnectNotification(
  event: 'reconnecting' | 'validated' | 'synced' | 'invalid' | 'error',
  context?: any
): void {
  const notifications: Record<string, ReconnectNotification> = {
    reconnecting: {
      type: 'info',
      title: 'Reconnecting',
      message: 'Validating your session...',
      duration: 3000
    },
    validated: {
      type: 'success',
      title: 'Connected',
      message: 'Session validated successfully',
      duration: 2000
    },
    synced: {
      type: 'success',
      title: 'Synced',
      message: `${context.count} changes synced successfully`,
      duration: 3000
    },
    invalid: {
      type: 'error',
      title: 'Session Expired',
      message: 'Please log in again to continue',
      duration: 5000
    },
    error: {
      type: 'error',
      title: 'Connection Error',
      message: context.error || 'Unable to validate session',
      duration: 5000
    }
  };
  
  const notification = notifications[event];
  showNotification(notification);
}
```

---

## Implementation Guide

### Step 1: Set Up Network Detection

```typescript
// Initialize network detector
const networkDetector = new NetworkDetector();

// Subscribe to network events
networkDetector.subscribe(event => {
  if (event === 'online') {
    console.log('Network online - triggering reconnect flow');
    reconnectManager.handleReconnect();
  } else {
    console.log('Network offline');
    showStatusIndicator('offline');
  }
});
```

### Step 2: Implement Reconnect Manager

```typescript
class ReconnectManager {
  private state: ReconnectState = ReconnectState.OFFLINE;
  
  async handleReconnect(): Promise<void> {
    this.setState(ReconnectState.DETECTING);
    showStatusIndicator('reconnecting');
    
    // Get session
    const session = await sessionManager.getSession();
    if (!session) {
      console.log('No session to validate');
      this.setState(ReconnectState.COMPLETE);
      return;
    }
    
    // Validate session
    this.setState(ReconnectState.VALIDATING);
    showStatusIndicator('validating');
    
    const result = await sessionValidator.validateSession(session);
    
    if (result.valid) {
      // Session valid - proceed to sync
      this.setState(ReconnectState.VALID);
      showReconnectNotification('validated');
      
      await this.syncPendingChanges();
    } else {
      // Session invalid - handle
      this.setState(ReconnectState.INVALID);
      await handleInvalidSession(result.reason);
    }
  }
  
  private async syncPendingChanges(): Promise<void> {
    this.setState(ReconnectState.SYNCING);
    
    const pendingCount = await transactionQueue.getPendingCount();
    showStatusIndicator('syncing', pendingCount);
    
    try {
      await syncEngine.sync();
      
      this.setState(ReconnectState.COMPLETE);
      showStatusIndicator('online');
      showReconnectNotification('synced', { count: pendingCount });
      
    } catch (error) {
      this.setState(ReconnectState.ERROR);
      showStatusIndicator('error');
      showReconnectNotification('error', { error: error.message });
    }
  }
  
  private setState(state: ReconnectState): void {
    this.state = state;
    console.log(`Reconnect state: ${state}`);
  }
}
```

### Step 3: Handle Re-Login After Invalidation

```typescript
async function handleReLogin(credentials: Credentials): Promise<void> {
  try {
    // Authenticate with server
    const session = await authenticate(credentials);
    
    // Save new session
    await sessionManager.saveSession(session);
    
    // Sync pending changes
    const pendingCount = await transactionQueue.getPendingCount();
    if (pendingCount > 0) {
      showNotification(`Syncing ${pendingCount} pending changes...`, 'info');
      await syncEngine.sync();
      showNotification('All changes synced!', 'success');
    }
    
    // Close re-login dialog
    closeReLoginDialog();
    
  } catch (error) {
    throw new Error(`Login failed: ${error.message}`);
  }
}
```

---

## API Specification

### Validate Session Endpoint

```http
POST /api/auth/validate-session
Content-Type: application/json
Authorization: Bearer {sessionToken}

{
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "deviceId": "device-123",
  "metadata": {
    "offlineDuration": 3600000,
    "lastActivity": 1706745600000,
    "appVersion": "1.0.0",
    "platform": "web"
  }
}
```

**Response (Valid Session):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "valid": true,
  "newToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": 1706831999000
}
```

**Response (Invalid Session):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "valid": false,
  "reason": "session_expired",
  "message": "Session expired after 24 hours offline"
}
```

**Response (Server Error):**
```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "internal_server_error",
  "message": "Unable to validate session"
}
```

### Invalid Session Reasons

| Reason | Description | User Action |
|--------|-------------|-------------|
| `session_expired` | Session expired (24+ hours offline) | Re-login required |
| `session_revoked` | Session revoked by admin or user | Re-login required |
| `password_changed` | Password changed on another device | Re-login required |
| `account_disabled` | Account disabled by admin | Contact support |
| `device_removed` | Device removed from account | Re-login required |
| `token_invalid` | Token signature invalid or malformed | Re-login required |

---

## Security Considerations

### Token Refresh

```typescript
async function refreshToken(session: Session): Promise<Session> {
  const response = await fetch('/api/auth/refresh-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Token refresh failed');
  }
  
  const { newToken, expiresAt } = await response.json();
  
  session.token = newToken;
  session.expiresAt = expiresAt;
  
  return session;
}
```

### Secure Token Storage

```typescript
async function saveSessionSecurely(session: Session): Promise<void> {
  // Encrypt session before storing
  const encryptionKey = await getEncryptionKey();
  const encrypted = await encryptData(session, encryptionKey);
  
  // Store encrypted session
  await localStore.save('session', {
    userId: session.userId,
    data: encrypted
  });
}
```

### Rate Limiting

```typescript
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  async checkRateLimit(userId: string): Promise<boolean> {
    const now = Date.now();
    const window = 60000; // 1 minute
    const maxAttempts = 5;
    
    const userAttempts = this.attempts.get(userId) || [];
    
    // Remove attempts outside window
    const recentAttempts = userAttempts.filter(t => now - t < window);
    
    if (recentAttempts.length >= maxAttempts) {
      return false; // Rate limit exceeded
    }
    
    // Add current attempt
    recentAttempts.push(now);
    this.attempts.set(userId, recentAttempts);
    
    return true;
  }
}
```

---

## Conclusion

WebWaka's reconnect re-authentication flow ensures:

1. ✅ **Mandatory validation** - All reconnects trigger server validation
2. ✅ **Transparent operation** - Happens automatically in background
3. ✅ **Graceful handling** - Invalid sessions handled smoothly
4. ✅ **Clear communication** - Users understand why re-login is needed
5. ✅ **Data preservation** - Pending changes never lost

This flow maintains security while providing a seamless user experience during network transitions.

---

**Document Version:** 1.0  
**Last Updated:** February 1, 2026  
**Maintained By:** WebWaka Platform Team
