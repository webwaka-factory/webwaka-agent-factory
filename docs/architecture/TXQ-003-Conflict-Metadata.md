# TXQ-003 — Conflict Detection Metadata Architecture

**Author**: webwakaagent1  
**Date**: 2026-02-01  
**Status**: Complete  
**Version**: 1.0.0

## Overview

Metadata tracking system for detecting and resolving conflicts during synchronization.

## Design Principles

- **Comprehensive Tracking**: Version, timestamp, hash, user, device, causality
- **Deterministic Detection**: Algorithmic conflict detection
- **Flexible Resolution**: Multiple resolution strategies
- **Causality Preservation**: Parent-child transaction relationships

## Architecture

### Metadata Components

1. **Version**: Monotonically increasing counter
2. **Timestamps**: Server (authoritative) + device (fallback)
3. **Content Hash**: SHA-256 for integrity verification
4. **Identity**: User ID + device ID for attribution
5. **Causality**: Parent transaction IDs for dependency tracking

### Conflict Detection Algorithm

```
1. Compare versions
   → If equal and hashes match: NO CONFLICT
   → If different: VERSION_MISMATCH

2. Compare content hashes
   → If different with same version: HASH_MISMATCH

3. Check causality
   → If dependency order violated: CAUSALITY_VIOLATION

4. Check timestamps and devices
   → If concurrent from different devices: CONCURRENT_MODIFICATION
```

### Resolution Strategy

Default: **Last-Write-Wins**
- Uses server timestamp (if available)
- Falls back to device timestamp
- Tiebreaker: Device ID (lexicographic)

---

**References**

[1] WebWaka Agent Factory, "TXQ-001 — Transaction Queue", [https://github.com/webwakaagent1/webwaka-agent-factory/issues/37](https://github.com/webwakaagent1/webwaka-agent-factory/issues/37)
