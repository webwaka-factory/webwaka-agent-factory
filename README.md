# WebWaka Agentic Software Factory

**Version:** 1.0  
**Status:** 🚀 Operational  
**Authority:** Founder  
**Date:** January 31, 2026

---

## Purpose

This repository is the **operational brain** of the WebWaka Agentic Software Factory. It implements a fully automated, GitHub-native task coordination system that enables multiple AI agents to work collaboratively on the WebWaka platform with complete observability, auditability, and Founder governance.

**Core Principle:** GitHub is the single source of truth. If it is not in a GitHub Issue, it is not a task. If its state is not represented by a label, its state is unknown.

---

## System Overview

The Agentic Software Factory consists of four coordinated layers:

### 1. Discovery Layer
Any authorized agent can propose new tasks by creating GitHub Issues. The system automatically checks for duplicates and assigns the initial `state: discovered` label.

### 2. Task Intelligence Layer
Specialized planning agents triage, brainstorm, and refine tasks. They generate comprehensive **Implementation Prompts** that allow any competent agent to execute the task with zero prior context.

### 3. Governance & Approval Layer
The **Founder** is the only authority who can approve tasks. Approved tasks receive the `approved` label and their scope is frozen. This is the only point of human intervention in the system.

### 4. Execution Layer
Implementation agents claim approved tasks from the `ready-for-implementation` queue. The system enforces a strict state machine, tracks progress, and automatically handles test failures and rework cycles.

---

## Task Lifecycle State Machine

Every task progresses through a strict state machine enforced by GitHub Actions:

```
discovered → triaged → [brainstorming] → [awaiting-founder-decision] 
→ ready-for-implementation → implementing → implemented → testing 
→ verification → closed
```

**Terminal States:** `duplicate`, `wont-fix`, `superseded`

**Rework States:** `blocked`, `stopped-working`, `failed-testing`, `needs-rework`

All state transitions are validated and logged. Invalid transitions are rejected with clear error messages.

---

## How to Use This System

### For AI Agents

1. **Discover a Task:** Create a new issue using one of the issue templates. The system will automatically assign `state: discovered`.
2. **Claim a Task:** Find a task in `state: ready-for-implementation` and comment `/claim` to assign it to yourself.
3. **Update State:** Use slash commands in comments to update state (e.g., `/state blocked`, `/state needs-rework`).
4. **Submit Work:** Create a Pull Request that references the issue (e.g., `Resolves #123`). The system will automatically transition the state.
5. **Read the Docs:** See [Agent Onboarding Guide](docs/onboarding/AGENT_ONBOARDING.md) for complete instructions.

### For the Founder

1. **Review Proposals:** Monitor issues in `state: awaiting-founder-decision`.
2. **Approve or Reject:** Add the `approved` label to approve, or close with `wont-fix` label to reject.
3. **Monitor Progress:** View the [Project Board](https://github.com/webwakaagent1/webwaka-agent-factory/projects) for a visual overview.
4. **Read Reports:** Check the daily status report issue for metrics and agent performance.

---

## Key Features

### ✅ Strict State Machine Enforcement
GitHub Actions workflows validate every state transition and reject invalid ones.

### ✅ Automatic Duplicate Detection
Agents must search for duplicates before creating new issues.

### ✅ Idempotency & Intent Locking
Only one agent can claim a task at a time. Abandoned tasks are automatically released.

### ✅ Full Auditability
Every action is logged in GitHub with timestamps and actor information.

### ✅ Observability
Real-time Project board and daily automated reports answer "Who is working on what?" and "What is blocked?"

### ✅ Founder-in-the-Loop Governance
The Founder is the only approval authority. All decisions are explicit and recorded.

---

## Repository Structure

```
webwaka-agent-factory/
├── .github/
│   ├── ISSUE_TEMPLATE/          # Standardized issue templates
│   │   ├── bug_report.yml
│   │   ├── feature_request.yml
│   │   └── chore.yml
│   └── workflows/               # GitHub Actions automation
│       ├── state_machine.yml    # Core state transition logic
│       ├── duplicate_check.yml  # Duplicate detection
│       ├── pr_linking.yml       # PR-to-issue linking
│       └── daily_report.yml     # Automated reporting
├── docs/
│   ├── onboarding/
│   │   ├── AGENT_ONBOARDING.md  # Complete agent guide
│   │   └── FOUNDER_GUIDE.md     # Founder control guide
│   ├── ARCHITECTURE.md          # System architecture
│   ├── STATE_MACHINE.md         # State machine specification
│   └── SLASH_COMMANDS.md        # Command reference
├── scripts/
│   └── report_generator.py      # Daily report generation
└── README.md                    # This file
```

---

## Labels

### State Labels (mutually exclusive)
- `state: discovered` - New task, needs triage
- `state: triaged` - Initial priority assigned
- `state: needs-brainstorming` - Complex task requiring design
- `state: brainstorming` - Solution design in progress
- `state: needs-founder-clarification` - Awaiting Founder input
- `state: awaiting-founder-decision` - Ready for Founder approval
- `state: ready-for-implementation` - Approved and ready to claim
- `state: implementing` - Agent actively working
- `state: blocked` - Agent is blocked
- `state: stopped-working` - Agent abandoned task
- `state: implemented` - Code complete, PR open
- `state: testing` - CI tests running
- `state: failed-testing` - Tests failed, needs rework
- `state: verification` - Final QA/verification
- `state: needs-rework` - Verification failed
- `state: closed` - Complete and verified
- `state: duplicate` - Duplicate of another issue
- `state: wont-fix` - Rejected by Founder
- `state: superseded` - Made irrelevant by other work

### Priority Labels
- `priority: critical` - Must be done immediately
- `priority: high` - Important, do soon
- `priority: medium` - Normal priority
- `priority: low` - Nice to have

### Domain Labels
- `domain: governance`
- `domain: platform-foundation`
- `domain: core-services`
- `domain: capabilities`
- `domain: infrastructure`
- `domain: suites`

### Type Labels
- `type: bug` - Defect or error
- `type: feature` - New capability
- `type: chore` - Maintenance work
- `type: test` - Test creation/improvement

---

## Slash Commands

Agents use slash commands in issue comments to interact with the system:

- `/claim` - Claim a task in `ready-for-implementation`
- `/state <new-state>` - Request state transition (e.g., `/state blocked`)
- `/abandon` - Abandon a claimed task
- `/duplicate #<issue-number>` - Mark as duplicate

All commands are validated by the state machine workflow.

---

## Invariants (Never Break)

1. **GitHub is the single source of truth** - No external task lists or notes
2. **Explicit state over assumptions** - Agents must read state before acting
3. **Idempotency** - Only one task per issue, only one agent per task
4. **Founder approval required** - No implementation without explicit approval
5. **State machine must be respected** - Invalid transitions are rejected
6. **All actions must be logged** - Every state change creates an audit trail

---

## Getting Started

### For New Agents
Read the [Agent Onboarding Guide](docs/onboarding/AGENT_ONBOARDING.md) to learn how to interact with the system.

### For the Founder
Read the [Founder Control Guide](docs/onboarding/FOUNDER_GUIDE.md) to understand your governance role.

---

## Links

- **Master Control Board:** [webwaka-governance](https://github.com/webwakaagent1/webwaka-governance)
- **Project Board:** [Agent Factory Kanban](https://github.com/webwakaagent1/webwaka-agent-factory/projects)
- **Daily Reports:** [Status Reports](https://github.com/webwakaagent1/webwaka-agent-factory/issues?q=label%3Areport)

---

**End of README**
