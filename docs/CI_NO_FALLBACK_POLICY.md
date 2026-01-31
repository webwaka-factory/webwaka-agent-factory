# CI/CD No Fallback Policy

**Version:** 1.0  
**Date:** January 31, 2026  
**Status:** ENFORCED

---

## Executive Summary

The WebWaka Agentic Software Factory enforces a **strict "no fallback" policy** for all CI/CD pipelines. This means that test failures, validation errors, and security issues **must block deployment**. There are no exceptions, workarounds, or fallback mechanisms that allow broken code to pass through the pipeline.

---

## Policy Statement

> **All CI/CD checks must pass before code can be merged or deployed. There are no fallback flags, error suppression mechanisms, or workarounds permitted in the pipeline configuration.**

This policy exists because:

1. **Quality gates must be meaningful** - A test that can be bypassed provides no value
2. **Technical debt compounds** - Ignoring failures today creates larger problems tomorrow
3. **Trust requires consistency** - Agents and humans must trust that passing CI means the code works
4. **Governance requires enforcement** - The Founder's approval process assumes CI has validated the work

---

## Prohibited Patterns

The following patterns are **strictly prohibited** in all workflow files:

### 1. Continue on Error

```yaml
# ❌ PROHIBITED
- name: Run tests
  continue-on-error: true
  run: npm test
```

### 2. Exit Code Suppression

```yaml
# ❌ PROHIBITED
- name: Run tests
  run: npm test || true

# ❌ PROHIBITED
- name: Run tests
  run: npm test || exit 0
```

### 3. Conditional Execution That Skips Failures

```yaml
# ❌ PROHIBITED
- name: Deploy
  if: always()  # Runs even if previous steps failed
  run: ./deploy.sh
```

### 4. Failure-Tolerant Aggregation

```yaml
# ❌ PROHIBITED
- name: Check results
  run: |
    # Count failures but don't fail the build
    FAILURES=$(cat test-results.txt | grep FAIL | wc -l)
    echo "Found $FAILURES failures (continuing anyway)"
```

### 5. Optional Test Execution

```yaml
# ❌ PROHIBITED
- name: Run tests (optional)
  if: env.RUN_TESTS == 'true'
  run: npm test
```

---

## Required Patterns

All CI workflows **must** follow these patterns:

### 1. Strict Failure Propagation

```yaml
# ✅ REQUIRED
- name: Run tests
  run: npm test
  # No continue-on-error, no || true
```

### 2. Explicit Status Checks

```yaml
# ✅ REQUIRED
status:
  name: CI Status
  needs: [validate, lint, test, security]
  if: always()
  steps:
    - name: Check All Jobs
      run: |
        if [ "${{ needs.test.result }}" != "success" ]; then
          echo "❌ Tests failed"
          exit 1
        fi
```

### 3. Clear Failure Messages

```yaml
# ✅ REQUIRED
- name: Validate
  run: |
    if [ ! -f "required-file.txt" ]; then
      echo "❌ Required file missing"
      exit 1  # Explicit failure
    fi
```

---

## Enforcement Mechanism

This policy is enforced through multiple layers:

### Layer 1: Workflow Design

The CI workflow (`ci.yml`) is designed with no fallback mechanisms. Each job depends on previous jobs, and the final status check explicitly verifies all jobs passed.

### Layer 2: Branch Protection

The repository should be configured with branch protection rules that:
- Require the `CI / CI Status` check to pass before merge
- Require PR reviews
- Prevent force pushes to main

### Layer 3: Code Review

All changes to workflow files must be reviewed to ensure no fallback patterns are introduced.

### Layer 4: Automated Scanning

The CI pipeline includes a security job that scans for dangerous patterns in workflow files.

---

## What To Do When Tests Fail

When CI fails, the correct response is **always** to fix the underlying issue:

| Situation | Correct Response | Incorrect Response |
|-----------|------------------|-------------------|
| Test is flaky | Fix the test to be deterministic | Add retry logic or continue-on-error |
| Test takes too long | Optimize the test or split into parallel jobs | Skip the test |
| Test fails intermittently | Investigate and fix the root cause | Ignore the failure |
| External service is down | Mock the service or wait for it to recover | Bypass the test |
| Test environment issue | Fix the environment configuration | Disable the test |

---

## Exception Process

There is **no exception process**. This policy has no exceptions.

If you believe a situation warrants bypassing CI:
1. You are wrong
2. Fix the underlying issue instead
3. If truly blocked, use `/state blocked` on the issue and wait for resolution

---

## Rationale

### Why So Strict?

The Agentic Software Factory operates with minimal human oversight. AI agents work autonomously, claiming tasks and submitting PRs. The CI pipeline is the **primary quality gate** that ensures agents are producing working code.

If agents learn they can bypass CI:
- They will take shortcuts
- Quality will degrade
- Technical debt will accumulate
- The Founder will lose trust in the system

### The Cost of Fallbacks

Every fallback flag has a cost:

| Fallback | Immediate Cost | Long-term Cost |
|----------|---------------|----------------|
| `continue-on-error: true` | Hidden failures | Broken production code |
| `|| true` | Suppressed errors | Undetected regressions |
| `if: always()` | Deploys despite failures | Customer-facing bugs |
| Optional tests | Inconsistent coverage | Growing blind spots |

---

## Compliance Checklist

Before merging any workflow changes, verify:

- [ ] No `continue-on-error: true` anywhere
- [ ] No `|| true` or `|| exit 0` patterns
- [ ] No `if: always()` on deployment steps
- [ ] All jobs have explicit dependencies
- [ ] Final status check verifies all jobs passed
- [ ] Failure messages are clear and actionable
- [ ] No environment variables that skip tests

---

## Related Documentation

- [CI Workflow Configuration](.github/workflows/ci.yml)
- [State Machine Specification](STATE_MACHINE.md)
- [Agent Onboarding Guide](onboarding/AGENT_ONBOARDING.md)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-31 | Initial policy document |

---

**This policy is non-negotiable. Quality is not optional.**
