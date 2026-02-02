# WebWaka Transaction Retry & Failure Strategy

**Version:** 1.0  
**Last Updated:** February 1, 2026  
**Issue:** #38 (TXQ-002)

---

## Table of Contents

1. [Overview](#overview)
2. [Failure Classification](#failure-classification)
3. [Retry Strategy](#retry-strategy)
4. [Circuit Breaker](#circuit-breaker)
5. [Failure Handling](#failure-handling)
6. [User Visibility](#user-visibility)
7. [Ambiguous Failure Handling](#ambiguous-failure-handling)
8. [Implementation Guide](#implementation-guide)
9. [Testing Strategy](#testing-strategy)
10. [Monitoring & Analytics](#monitoring--analytics)

---

## Overview

WebWaka's transaction queue requires robust retry logic to handle network failures gracefully. This specification defines how transactions are retried, how failures are classified, and how the system prevents cascading failures.

### Core Principles

1. **Graceful degradation** - Network failures don't break the app
2. **Smart retry** - Exponential backoff with jitter
3. **Failure classification** - Different failures handled differently
4. **Circuit breaker** - Prevent cascading failures
5. **User transparency** - Users see what's happening
6. **No silent failures** - All failures logged and tracked

---

## Failure Classification

### Failure Types

```typescript
enum FailureType {
  RETRYABLE = 'retryable',     // Network errors, temporary server issues
  TERMINAL = 'terminal',        // Auth errors, validation errors
  AMBIGUOUS = 'ambiguous'       // 5xx errors, timeouts
}

interface FailureClassification {
  type: FailureType;
  httpStatus?: number;
  errorCode?: string;
  message: string;
  retryable: boolean;
  requiresUserAction: boolean;
}
```

### Classification Rules

| HTTP Status | Error Type | Failure Type | Retryable | User Action |
|-------------|------------|--------------|-----------|-------------|
| **Network Errors** |
| 0 (No response) | Network | RETRYABLE | ✅ Yes | None |
| Timeout | Network | RETRYABLE | ✅ Yes | None |
| DNS failure | Network | RETRYABLE | ✅ Yes | None |
| **Client Errors (4xx)** |
| 400 Bad Request | Validation | TERMINAL | ❌ No | Fix data |
| 401 Unauthorized | Auth | TERMINAL | ❌ No | Re-login |
| 403 Forbidden | Permission | TERMINAL | ❌ No | Contact admin |
| 404 Not Found | Resource | TERMINAL | ❌ No | Check data |
| 409 Conflict | Conflict | TERMINAL | ❌ No | Resolve conflict |
| 422 Unprocessable | Validation | TERMINAL | ❌ No | Fix data |
| 429 Rate Limit | Rate Limit | RETRYABLE | ✅ Yes (after delay) | None |
| **Server Errors (5xx)** |
| 500 Internal Error | Server | AMBIGUOUS | ⚠️ Maybe | None |
| 502 Bad Gateway | Gateway | RETRYABLE | ✅ Yes | None |
| 503 Service Unavailable | Server | RETRYABLE | ✅ Yes | None |
| 504 Gateway Timeout | Gateway | RETRYABLE | ✅ Yes | None |

### Classification Implementation

```typescript
class FailureClassifier {
  classify(error: Error | Response): FailureClassification {
    // Network errors (no response)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        type: FailureType.RETRYABLE,
        errorCode: 'NETWORK_ERROR',
        message: 'Network connection failed',
        retryable: true,
        requiresUserAction: false
      };
    }
    
    // Timeout errors
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return {
        type: FailureType.RETRYABLE,
        errorCode: 'TIMEOUT',
        message: 'Request timed out',
        retryable: true,
        requiresUserAction: false
      };
    }
    
    // HTTP response errors
    if (error instanceof Response) {
      return this.classifyHttpStatus(error.status);
    }
    
    // Unknown errors
    return {
      type: FailureType.AMBIGUOUS,
      errorCode: 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      retryable: false,
      requiresUserAction: true
    };
  }
  
  private classifyHttpStatus(status: number): FailureClassification {
    // 2xx Success (should not be classified as failure)
    if (status >= 200 && status < 300) {
      throw new Error('Success status should not be classified as failure');
    }
    
    // 4xx Client Errors
    if (status >= 400 && status < 500) {
      return this.classifyClientError(status);
    }
    
    // 5xx Server Errors
    if (status >= 500 && status < 600) {
      return this.classifyServerError(status);
    }
    
    // Unknown status
    return {
      type: FailureType.AMBIGUOUS,
      httpStatus: status,
      message: `Unexpected HTTP status: ${status}`,
      retryable: false,
      requiresUserAction: true
    };
  }
  
  private classifyClientError(status: number): FailureClassification {
    const classifications: Record<number, FailureClassification> = {
      400: {
        type: FailureType.TERMINAL,
        httpStatus: 400,
        errorCode: 'BAD_REQUEST',
        message: 'Invalid request data',
        retryable: false,
        requiresUserAction: true
      },
      401: {
        type: FailureType.TERMINAL,
        httpStatus: 401,
        errorCode: 'UNAUTHORIZED',
        message: 'Authentication required',
        retryable: false,
        requiresUserAction: true
      },
      403: {
        type: FailureType.TERMINAL,
        httpStatus: 403,
        errorCode: 'FORBIDDEN',
        message: 'Permission denied',
        retryable: false,
        requiresUserAction: true
      },
      404: {
        type: FailureType.TERMINAL,
        httpStatus: 404,
        errorCode: 'NOT_FOUND',
        message: 'Resource not found',
        retryable: false,
        requiresUserAction: true
      },
      409: {
        type: FailureType.TERMINAL,
        httpStatus: 409,
        errorCode: 'CONFLICT',
        message: 'Data conflict detected',
        retryable: false,
        requiresUserAction: true
      },
      422: {
        type: FailureType.TERMINAL,
        httpStatus: 422,
        errorCode: 'UNPROCESSABLE',
        message: 'Validation failed',
        retryable: false,
        requiresUserAction: true
      },
      429: {
        type: FailureType.RETRYABLE,
        httpStatus: 429,
        errorCode: 'RATE_LIMIT',
        message: 'Rate limit exceeded',
        retryable: true,
        requiresUserAction: false
      }
    };
    
    return classifications[status] || {
      type: FailureType.TERMINAL,
      httpStatus: status,
      message: `Client error: ${status}`,
      retryable: false,
      requiresUserAction: true
    };
  }
  
  private classifyServerError(status: number): FailureClassification {
    const retryableStatuses = [502, 503, 504];
    
    if (retryableStatuses.includes(status)) {
      return {
        type: FailureType.RETRYABLE,
        httpStatus: status,
        errorCode: 'SERVER_ERROR',
        message: 'Server temporarily unavailable',
        retryable: true,
        requiresUserAction: false
      };
    }
    
    // 500 and other 5xx are ambiguous
    return {
      type: FailureType.AMBIGUOUS,
      httpStatus: status,
      errorCode: 'SERVER_ERROR',
      message: 'Server error occurred',
      retryable: false,
      requiresUserAction: false
    };
  }
}
```

---

## Retry Strategy

### Exponential Backoff

```typescript
interface RetryConfig {
  maxRetries: number;        // 6 attempts
  baseDelay: number;         // 1000ms (1 second)
  maxDelay: number;          // 32000ms (32 seconds)
  jitterFactor: number;      // 0.1 (10% jitter)
  backoffMultiplier: number; // 2 (exponential)
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 6,
  baseDelay: 1000,
  maxDelay: 32000,
  jitterFactor: 0.1,
  backoffMultiplier: 2
};
```

### Retry Delays

| Attempt | Base Delay | With Jitter (±10%) | Cumulative Time |
|---------|------------|-------------------|-----------------|
| 1 | 1s | 0.9s - 1.1s | 1s |
| 2 | 2s | 1.8s - 2.2s | 3s |
| 3 | 4s | 3.6s - 4.4s | 7s |
| 4 | 8s | 7.2s - 8.8s | 15s |
| 5 | 16s | 14.4s - 17.6s | 31s |
| 6 | 32s | 28.8s - 35.2s | 63s |

### Retry Implementation

```typescript
class RetryStrategy {
  private config: RetryConfig;
  
  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }
  
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: RetryContext
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Execute operation
        const result = await operation();
        
        // Success - log and return
        if (attempt > 0) {
          console.log(`Operation succeeded after ${attempt} retries`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Classify failure
        const classification = new FailureClassifier().classify(error);
        
        // Terminal failures - don't retry
        if (classification.type === FailureType.TERMINAL) {
          console.log(`Terminal failure: ${classification.message}`);
          throw error;
        }
        
        // Last attempt - don't retry
        if (attempt === this.config.maxRetries) {
          console.log(`Max retries (${this.config.maxRetries}) reached`);
          throw error;
        }
        
        // Calculate delay
        const delay = this.calculateDelay(attempt);
        
        console.log(`Attempt ${attempt + 1} failed: ${classification.message}. Retrying in ${delay}ms...`);
        
        // Wait before retry
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }
  
  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ attempt)
    const exponentialDelay = this.config.baseDelay * Math.pow(
      this.config.backoffMultiplier,
      attempt
    );
    
    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);
    
    // Add jitter (±10%)
    const jitter = cappedDelay * this.config.jitterFactor * (Math.random() * 2 - 1);
    const delayWithJitter = cappedDelay + jitter;
    
    return Math.max(0, Math.round(delayWithJitter));
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Rate Limit Handling

```typescript
async function handleRateLimit(response: Response): Promise<number> {
  // Check for Retry-After header
  const retryAfter = response.headers.get('Retry-After');
  
  if (retryAfter) {
    // Retry-After can be seconds or HTTP date
    const retryAfterSeconds = parseInt(retryAfter, 10);
    
    if (!isNaN(retryAfterSeconds)) {
      return retryAfterSeconds * 1000; // Convert to milliseconds
    }
    
    // Parse HTTP date
    const retryAfterDate = new Date(retryAfter);
    const now = new Date();
    const delay = retryAfterDate.getTime() - now.getTime();
    
    return Math.max(0, delay);
  }
  
  // Default rate limit delay: 60 seconds
  return 60000;
}
```

---

## Circuit Breaker

### Circuit Breaker States

```typescript
enum CircuitState {
  CLOSED = 'closed',       // Normal operation
  OPEN = 'open',           // Failing, reject requests
  HALF_OPEN = 'half_open'  // Testing if service recovered
}

interface CircuitBreakerConfig {
  failureThreshold: number;    // 3 consecutive failures
  successThreshold: number;    // 2 consecutive successes to close
  timeout: number;             // 30 seconds before trying half-open
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;
  
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000,
      ...config
    };
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      // Check if timeout has passed
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      
      if (timeSinceFailure < this.config.timeout) {
        throw new Error('Circuit breaker is OPEN. Service unavailable.');
      }
      
      // Timeout passed - try half-open
      this.state = CircuitState.HALF_OPEN;
      console.log('Circuit breaker: OPEN → HALF_OPEN');
    }
    
    try {
      // Execute operation
      const result = await operation();
      
      // Success
      this.onSuccess();
      
      return result;
      
    } catch (error) {
      // Failure
      this.onFailure();
      
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        console.log('Circuit breaker: HALF_OPEN → CLOSED');
      }
    }
  }
  
  private onFailure(): void {
    this.successCount = 0;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.log('Circuit breaker: CLOSED → OPEN');
    }
  }
  
  getState(): CircuitState {
    return this.state;
  }
  
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    console.log('Circuit breaker: RESET → CLOSED');
  }
}
```

---

## Failure Handling

### Failure Tracking

```typescript
interface FailureRecord {
  transactionId: string;
  timestamp: number;
  attempt: number;
  classification: FailureClassification;
  error: Error;
  context: {
    operation: string;
    entityType: string;
    entityId: string;
  };
}

class FailureTracker {
  private failures: Map<string, FailureRecord[]> = new Map();
  
  async recordFailure(
    transactionId: string,
    attempt: number,
    error: Error,
    context: any
  ): Promise<void> {
    const classification = new FailureClassifier().classify(error);
    
    const record: FailureRecord = {
      transactionId,
      timestamp: Date.now(),
      attempt,
      classification,
      error,
      context
    };
    
    // Get existing failures for this transaction
    const existingFailures = this.failures.get(transactionId) || [];
    existingFailures.push(record);
    this.failures.set(transactionId, existingFailures);
    
    // Log failure
    console.error(`Transaction ${transactionId} failed (attempt ${attempt}):`, {
      type: classification.type,
      message: classification.message,
      error: error.message
    });
    
    // Send to analytics
    await this.sendToAnalytics(record);
  }
  
  getFailures(transactionId: string): FailureRecord[] {
    return this.failures.get(transactionId) || [];
  }
  
  getFailurePattern(transactionId: string): FailurePattern {
    const failures = this.getFailures(transactionId);
    
    if (failures.length === 0) {
      return { pattern: 'none', severity: 'none' };
    }
    
    // Analyze pattern
    const types = failures.map(f => f.classification.type);
    const allRetryable = types.every(t => t === FailureType.RETRYABLE);
    const allTerminal = types.every(t => t === FailureType.TERMINAL);
    const hasAmbiguous = types.some(t => t === FailureType.AMBIGUOUS);
    
    if (allTerminal) {
      return { pattern: 'terminal', severity: 'high' };
    } else if (allRetryable) {
      return { pattern: 'network', severity: 'medium' };
    } else if (hasAmbiguous) {
      return { pattern: 'ambiguous', severity: 'high' };
    } else {
      return { pattern: 'mixed', severity: 'medium' };
    }
  }
  
  private async sendToAnalytics(record: FailureRecord): Promise<void> {
    // Send to analytics service
    await analytics.track('transaction_failure', {
      transactionId: record.transactionId,
      attempt: record.attempt,
      failureType: record.classification.type,
      errorCode: record.classification.errorCode,
      httpStatus: record.classification.httpStatus,
      operation: record.context.operation,
      entityType: record.context.entityType
    });
  }
}
```

---

## User Visibility

### Failed Transaction UI

```typescript
interface FailedTransaction {
  id: string;
  operation: string;
  entityType: string;
  entityId: string;
  failureCount: number;
  lastFailure: FailureRecord;
  status: 'retrying' | 'failed' | 'paused';
}

function FailedTransactionsList({ transactions }: { transactions: FailedTransaction[] }) {
  return (
    <div className="failed-transactions">
      <h3>Failed Transactions</h3>
      
      {transactions.length === 0 && (
        <p className="text-muted">No failed transactions</p>
      )}
      
      {transactions.map(tx => (
        <FailedTransactionCard key={tx.id} transaction={tx} />
      ))}
    </div>
  );
}

function FailedTransactionCard({ transaction }: { transaction: FailedTransaction }) {
  const { lastFailure } = transaction;
  const classification = lastFailure.classification;
  
  return (
    <Card className={`failed-transaction ${transaction.status}`}>
      <CardHeader>
        <h4>{transaction.operation}</h4>
        <Badge variant={getStatusVariant(transaction.status)}>
          {transaction.status}
        </Badge>
      </CardHeader>
      
      <CardBody>
        <p><strong>Entity:</strong> {transaction.entityType} #{transaction.entityId}</p>
        <p><strong>Attempts:</strong> {transaction.failureCount}</p>
        <p><strong>Last Error:</strong> {classification.message}</p>
        
        {classification.requiresUserAction && (
          <Alert type="warning">
            This transaction requires your attention.
          </Alert>
        )}
      </CardBody>
      
      <CardActions>
        {classification.type === FailureType.RETRYABLE && (
          <Button onClick={() => retryTransaction(transaction.id)}>
            Retry Now
          </Button>
        )}
        
        {classification.requiresUserAction && (
          <Button onClick={() => fixTransaction(transaction.id)}>
            Fix & Retry
          </Button>
        )}
        
        <Button variant="secondary" onClick={() => cancelTransaction(transaction.id)}>
          Cancel
        </Button>
      </CardActions>
    </Card>
  );
}
```

---

## Ambiguous Failure Handling

### Idempotency Check

```typescript
interface IdempotencyRecord {
  transactionId: string;
  requestId: string;
  status: 'pending' | 'completed' | 'failed';
  result?: any;
  timestamp: number;
}

class IdempotencyManager {
  async checkIdempotency(transactionId: string): Promise<IdempotencyRecord | null> {
    // Check local store first
    const localRecord = await localStore.get('idempotency', transactionId);
    
    if (localRecord) {
      return localRecord;
    }
    
    // Check server
    try {
      const response = await fetch(`/api/transactions/${transactionId}/status`);
      
      if (response.ok) {
        const serverRecord = await response.json();
        
        // Cache locally
        await localStore.save('idempotency', serverRecord);
        
        return serverRecord;
      }
    } catch (error) {
      console.error('Failed to check idempotency:', error);
    }
    
    return null;
  }
  
  async handleAmbiguousFailure(
    transactionId: string,
    operation: () => Promise<any>
  ): Promise<any> {
    // Check if transaction already completed
    const record = await this.checkIdempotency(transactionId);
    
    if (record) {
      if (record.status === 'completed') {
        console.log(`Transaction ${transactionId} already completed`);
        return record.result;
      }
      
      if (record.status === 'pending') {
        console.log(`Transaction ${transactionId} still pending`);
        // Wait and check again
        await sleep(5000);
        return this.handleAmbiguousFailure(transactionId, operation);
      }
    }
    
    // Transaction not found or failed - safe to retry
    return await operation();
  }
}
```

---

## Implementation Guide

### Step 1: Set Up Retry Strategy

```typescript
const retryStrategy = new RetryStrategy({
  maxRetries: 6,
  baseDelay: 1000,
  maxDelay: 32000
});
```

### Step 2: Set Up Circuit Breaker

```typescript
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000
});
```

### Step 3: Execute Transaction with Retry

```typescript
async function executeTransaction(transaction: Transaction): Promise<any> {
  return await circuitBreaker.execute(async () => {
    return await retryStrategy.executeWithRetry(
      async () => {
        // Send transaction to server
        const response = await fetch('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(transaction),
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          throw response;
        }
        
        return await response.json();
      },
      { transactionId: transaction.id }
    );
  });
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('FailureClassifier', () => {
  it('should classify network errors as RETRYABLE', () => {
    const error = new TypeError('Failed to fetch');
    const classification = new FailureClassifier().classify(error);
    expect(classification.type).toBe(FailureType.RETRYABLE);
  });
  
  it('should classify 401 as TERMINAL', () => {
    const response = new Response(null, { status: 401 });
    const classification = new FailureClassifier().classify(response);
    expect(classification.type).toBe(FailureType.TERMINAL);
  });
});

describe('RetryStrategy', () => {
  it('should retry up to maxRetries times', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      throw new Error('Network error');
    };
    
    try {
      await retryStrategy.executeWithRetry(operation, {});
    } catch (error) {
      expect(attempts).toBe(7); // Initial + 6 retries
    }
  });
});

describe('CircuitBreaker', () => {
  it('should open after failureThreshold failures', async () => {
    const operation = async () => { throw new Error('Failure'); };
    
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {}
    }
    
    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
  });
});
```

---

## Monitoring & Analytics

### Metrics to Track

1. **Retry Rate:** Percentage of transactions requiring retries
2. **Failure Rate:** Percentage of transactions that ultimately fail
3. **Average Retry Count:** Average number of retries per transaction
4. **Circuit Breaker State:** Time spent in each state
5. **Failure Types:** Distribution of failure types (retryable, terminal, ambiguous)

### Analytics Events

```typescript
// Transaction retry
analytics.track('transaction_retry', {
  transactionId,
  attempt,
  delay,
  reason
});

// Transaction failure
analytics.track('transaction_failure', {
  transactionId,
  failureType,
  errorCode,
  attempts
});

// Circuit breaker state change
analytics.track('circuit_breaker_state_change', {
  from,
  to,
  reason
});
```

---

## Conclusion

WebWaka's transaction retry and failure strategy ensures:

1. ✅ **Graceful degradation** - Network failures don't break the app
2. ✅ **Smart retry** - Exponential backoff with jitter
3. ✅ **Failure classification** - Different failures handled appropriately
4. ✅ **Circuit breaker** - Prevents cascading failures
5. ✅ **User transparency** - Users see what's happening
6. ✅ **No silent failures** - All failures logged and tracked

This strategy provides robust error handling for offline-first operations.

---

**Document Version:** 1.0  
**Last Updated:** February 1, 2026  
**Maintained By:** WebWaka Platform Team
