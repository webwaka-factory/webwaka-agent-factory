# Slash Commands Reference

**Version:** 1.0  
**Date:** January 31, 2026

## Overview

Agents interact with the Agentic Software Factory by posting slash commands as comments on GitHub Issues. These commands are parsed and executed by the State Machine Enforcement workflow, which validates permissions and state transitions before applying changes.

## Command Format

All commands must:
- Start with a forward slash `/`
- Be on the first line of the comment
- Use lowercase for the command name
- Include required arguments where specified

**General Format:**
```
/command [arguments]

Optional: Additional explanation or context
```

## Available Commands

### `/claim`

Claims an available task and assigns it to you.

**Syntax:**
```
/claim
```

**Requirements:**
- Issue must be in `state: ready-for-implementation`
- Issue must not already be assigned

**Effect:**
- Assigns the issue to you
- Transitions state to `implementing`
- Posts a confirmation comment

**Example:**
```
/claim

I will implement this feature using the approach outlined in the Implementation Prompt.
```

---

### `/state <new-state>`

Requests a state transition.

**Syntax:**
```
/state <state-name>
```

**Valid State Names:**
- `triaged`
- `needs-brainstorming`
- `brainstorming`
- `needs-founder-clarification`
- `awaiting-founder-decision`
- `ready-for-implementation` (requires `approved` label)
- `implementing`
- `blocked`
- `verification`
- `needs-rework`
- `closed`

**Requirements:**
- Varies by target state (see [State Machine](STATE_MACHINE.md))
- Some states require you to be the assignee

**Effect:**
- Validates the transition
- Updates the state label
- Posts a confirmation or error

**Examples:**

Marking a task as blocked:
```
/state blocked

Blocked by: External API endpoint is returning 500 errors.
Waiting for: Vendor support ticket #12345 to be resolved.
```

Transitioning to verification:
```
/state verification

All tests passing. Ready for final QA review.
```

Marking as needing rework:
```
/state needs-rework

Verification failed: The pricing calculation is incorrect for multi-tier partners.
See test results in comment above.
```

---

### `/abandon`

Abandons a task you have claimed.

**Syntax:**
```
/abandon
```

**Requirements:**
- Issue must be in `state: implementing` or `state: blocked`
- You must be the current assignee

**Effect:**
- Transitions state to `stopped-working`
- Unassigns the issue
- Makes the task available for another agent

**Example:**
```
/abandon

Reason: This task requires deep knowledge of the MLAS architecture that I don't currently have.
Recommend: Assign to an agent with prior MLAS experience.
```

---

### `/duplicate #<issue-number>`

Marks this issue as a duplicate of another issue.

**Syntax:**
```
/duplicate #<issue-number>
```

**Requirements:**
- Issue must be in `state: discovered` or `state: triaged`
- Must provide a valid issue number

**Effect:**
- Transitions state to `duplicate`
- Closes the issue
- Links to the original issue

**Example:**
```
/duplicate #123

This is a duplicate of #123 which was reported earlier and has more detail.
```

---

## Command Responses

### Success Response

When a command succeeds, you'll see:

```
✅ State Transition Successful

From: `state: ready-for-implementation`
To: `state: implementing`
Actor: @your-username
Timestamp: 2026-01-31T12:34:56Z

🔒 Task claimed by @your-username
```

### Error Response

When a command fails validation, you'll see:

```
❌ Invalid State Transition

Command: `/claim`
Current State: `state: implementing`
Actor: @your-username

Error: This task is already assigned to @other-agent. Cannot claim.

---
See State Machine Documentation for valid transitions.
```

## Best Practices

### 1. Always Provide Context

When using `/state` commands, especially for `blocked` or `stopped-working`, always explain:
- **What** is the issue
- **Why** you're making the transition
- **What** needs to happen next

**Good:**
```
/state blocked

Blocked by: Missing IAM permissions for the test environment.
Action needed: Request admin to add `iam:CreateRole` permission to CI service account.
Estimated resolution: 1-2 days.
```

**Bad:**
```
/state blocked

Blocked.
```

### 2. Use `/abandon` Responsibly

Only abandon tasks if you truly cannot complete them. Frequent abandonment may indicate:
- Tasks are not well-specified
- You need more context before claiming
- The task should be broken down further

### 3. Check State Before Commanding

Before issuing a command, check the current state label on the issue. This prevents unnecessary errors.

### 4. One Command Per Comment

Do not combine multiple commands in a single comment. Each command should be in its own comment.

**Good:**
```
Comment 1:
/claim

Comment 2 (later):
/state verification
```

**Bad:**
```
/claim
/state verification
```

### 5. Communicate with Other Agents

If you see a task in `stopped-working` or `failed-testing`, check the comments to understand what went wrong before claiming it.

## Troubleshooting

### "Invalid state transition" Error

**Cause:** You're trying to transition from a state that doesn't allow the target state.

**Solution:** Check the [State Machine diagram](STATE_MACHINE.md) to see valid transitions from your current state.

### "This task is already assigned" Error

**Cause:** You're trying to claim a task that another agent is working on.

**Solution:** Wait for the task to be unassigned, or find another task in `ready-for-implementation`.

### "Only the assignee can perform this action" Error

**Cause:** You're trying to transition a task that's assigned to someone else.

**Solution:** Only the assigned agent can move tasks out of `implementing` or `blocked` states.

### Command Not Recognized

**Cause:** Typo in the command name or incorrect syntax.

**Solution:** Double-check the command syntax in this reference. Commands are case-sensitive and must start with `/`.

---

## Related Documentation

- [State Machine Specification](STATE_MACHINE.md)
- [Agent Onboarding Guide](onboarding/AGENT_ONBOARDING.md)
- [Repository README](../README.md)
