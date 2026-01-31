# State Machine Specification

**Version:** 1.0  
**Date:** January 31, 2026

## Overview

The WebWaka Agentic Software Factory uses a strict state machine to manage the entire task lifecycle. Every issue must be in exactly one state at all times, represented by a `state:*` label. State transitions are enforced by GitHub Actions workflows that validate each transition before applying it.

## State Diagram

```
┌─────────────┐
│  discovered │ ◄── New issues start here
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   triaged   │
└──────┬──────┘
       │
       ├──────────────────┐
       │                  │
       ▼                  ▼
┌──────────────────┐  ┌────────────────────────┐
│ needs-brainstorm │  │ needs-founder-clarify  │
└────────┬─────────┘  └──────────┬─────────────┘
         │                       │
         ▼                       │
┌──────────────────┐             │
│  brainstorming   │             │
└────────┬─────────┘             │
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌────────────────────────┐
         │ awaiting-founder-      │
         │     decision           │
         └────────┬───────────────┘
                  │
                  │ (Founder approves)
                  ▼
         ┌────────────────────────┐
         │ ready-for-             │
         │  implementation        │
         └────────┬───────────────┘
                  │
                  │ (/claim)
                  ▼
         ┌────────────────────────┐
         │   implementing         │◄──┐
         └────────┬───────────────┘   │
                  │                   │
       ┌──────────┼──────────┐        │
       │          │          │        │
       ▼          ▼          ▼        │
┌──────────┐ ┌────────┐ ┌────────────┴─┐
│ blocked  │ │stopped-│ │  implemented │
└──────────┘ │working │ └────────┬─────┘
             └────────┘          │
                                 ▼
                        ┌────────────────┐
                        │    testing     │
                        └────────┬───────┘
                                 │
                      ┌──────────┼──────────┐
                      │                     │
                      ▼                     ▼
             ┌────────────────┐    ┌───────────────┐
             │ failed-testing │    │ verification  │
             └────────────────┘    └───────┬───────┘
                                           │
                                ┌──────────┼──────────┐
                                │                     │
                                ▼                     ▼
                       ┌────────────────┐    ┌───────────┐
                       │  needs-rework  │    │  closed   │
                       └────────────────┘    └───────────┘

Terminal States: duplicate, wont-fix, superseded
```

## State Definitions

| State | Description | Who Can Transition Here | Next Valid States |
|-------|-------------|------------------------|-------------------|
| `discovered` | New task, needs triage | System (automatic on issue creation) | `triaged`, `duplicate` |
| `triaged` | Initial priority assigned, ready for intelligence work | Any agent | `needs-brainstorming`, `needs-founder-clarification`, `awaiting-founder-decision` |
| `needs-brainstorming` | Complex task requiring solution design | Any agent | `brainstorming` |
| `brainstorming` | Agent actively designing solution | Agent (via `/state brainstorming`) | `needs-founder-clarification`, `awaiting-founder-decision` |
| `needs-founder-clarification` | Requires Founder input to proceed | Any agent | `awaiting-founder-decision` |
| `awaiting-founder-decision` | Proposal ready for Founder approval | Any agent | `ready-for-implementation` (requires `approved` label), `wont-fix` |
| `ready-for-implementation` | Approved and ready to be claimed | Founder (via `approved` label) | `implementing` |
| `implementing` | Agent actively working on implementation | Agent (via `/claim`) | `blocked`, `stopped-working`, `implemented` |
| `blocked` | Agent is blocked and cannot proceed | Assigned agent only | `implementing` |
| `stopped-working` | Agent abandoned the task | Assigned agent only | `implementing` |
| `implemented` | Code complete, PR opened | System (automatic on PR open) | `testing` |
| `testing` | CI tests running | System (automatic) | `failed-testing`, `verification` |
| `failed-testing` | Tests failed, needs rework | System (automatic on CI failure) | `implementing` |
| `verification` | Final QA/verification in progress | Any agent | `needs-rework`, `closed` |
| `needs-rework` | Verification failed, needs fixes | Any agent | `implementing` |
| `closed` | Complete and verified | Any agent | (terminal) |
| `duplicate` | Duplicate of another issue | Any agent (via `/duplicate #N`) | (terminal) |
| `wont-fix` | Rejected by Founder | Founder only | (terminal) |
| `superseded` | Made irrelevant by other work | Any agent | (terminal) |

## Slash Commands

Agents interact with the state machine using slash commands in issue comments:

### `/claim`
Claims a task that is in `ready-for-implementation` state.

**Requirements:**
- Issue must be in `state: ready-for-implementation`
- Issue must not already be assigned

**Effect:**
- Assigns the issue to the commenting agent
- Transitions to `state: implementing`

**Example:**
```
/claim
```

### `/state <new-state>`
Requests a state transition.

**Requirements:**
- Varies by target state (see State Definitions table)
- Some transitions require the agent to be the assignee

**Effect:**
- Validates the transition
- Updates the state label
- May update assignee

**Examples:**
```
/state blocked
/state needs-rework
/state verification
```

### `/abandon`
Abandons a claimed task.

**Requirements:**
- Issue must be in `state: implementing` or `state: blocked`
- Agent must be the current assignee

**Effect:**
- Transitions to `state: stopped-working`
- Unassigns the issue
- Makes the task available for another agent to claim

**Example:**
```
/abandon

Reason: Blocked by external API issue that requires vendor support.
```

### `/duplicate #<issue-number>`
Marks the issue as a duplicate of another issue.

**Requirements:**
- Issue must be in `state: discovered` or `state: triaged`
- Must provide the number of the original issue

**Effect:**
- Transitions to `state: duplicate`
- Closes the issue
- Links to the original issue

**Example:**
```
/duplicate #123
```

## Automatic Transitions

Some state transitions happen automatically without agent intervention:

| Trigger | From State | To State |
|---------|-----------|----------|
| Issue created | (none) | `discovered` |
| PR opened with "Resolves #N" | `implementing` | `implemented` |
| CI tests pass | `implemented` | `testing` |
| CI tests fail | `implemented` or `testing` | `failed-testing` |

## Validation Rules

The state machine workflow enforces these rules:

1. **Single State:** An issue can only have one `state:*` label at a time.
2. **Valid Transitions:** Only transitions defined in the state diagram are allowed.
3. **Assignee Checks:** Some transitions require the agent to be the current assignee.
4. **Approval Required:** Transition to `ready-for-implementation` requires the `approved` label.
5. **Idempotency:** Claiming an already-assigned task is rejected.

## Error Handling

If an invalid transition is attempted, the workflow will:
1. Post an error comment explaining why the transition was rejected
2. NOT change the current state
3. Provide guidance on valid next states

**Example Error:**
```
❌ Invalid State Transition

Command: /claim
Current State: state: implementing
Actor: @agent-2

Error: This task is already assigned to @agent-1. Cannot claim.

---
See State Machine Documentation for valid transitions.
```

## Best Practices for Agents

1. **Always check current state** before attempting a transition
2. **Use descriptive comments** when changing state (especially for `blocked` or `stopped-working`)
3. **Only claim tasks you can complete** - abandoning tasks creates overhead
4. **Communicate blockers clearly** when transitioning to `blocked`
5. **Verify your work** before transitioning to `verification`

---

**For more information, see:**
- [Agent Onboarding Guide](onboarding/AGENT_ONBOARDING.md)
- [Slash Commands Reference](SLASH_COMMANDS.md)
- [Repository README](../README.md)
