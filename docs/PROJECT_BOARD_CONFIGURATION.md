# Project Board Configuration Guide

**Document:** PROJECT_BOARD_CONFIGURATION.md  
**Purpose:** Instructions for configuring the Agent Factory Kanban board with state-based columns  
**Last Updated:** January 31, 2026

---

## Overview

The Agent Factory Kanban board can be configured with granular state-based columns that match the state machine labels. This provides enhanced visibility into the workflow and makes it easier to track issues through their lifecycle.

**Current Configuration:** The board uses a simple 3-column system (Todo, In Progress, Done).

**Recommended Configuration:** State-based columns that mirror the state machine.

---

## Recommended Column Configuration

### Option 1: Simple 3-Column System (Current)

**Best for:** Quick overview, minimal complexity

| Column | Description |
|--------|-------------|
| **Todo** | Issues ready to be worked on |
| **In Progress** | Issues currently being worked on |
| **Done** | Completed issues |

**Pros:**
- Simple and easy to understand
- Low maintenance
- Works well for small teams

**Cons:**
- Less granular visibility
- Doesn't reflect the full state machine

---

### Option 2: State-Based Columns (Recommended)

**Best for:** Full visibility into the workflow, matches state machine exactly

The following columns match the state labels defined in the state machine:

| Column | State Label | Description |
|--------|-------------|-------------|
| **Discovered** | `state: discovered` | Newly identified issues |
| **Triaged** | `state: triaged` | Issues that have been reviewed and categorized |
| **Needs Brainstorming** | `state: needs-brainstorming` | Issues requiring design thinking |
| **Brainstorming** | `state: brainstorming` | Active design/planning work |
| **Needs Founder Clarification** | `state: needs-founder-clarification` | Awaiting Founder input |
| **Awaiting Founder Decision** | `state: awaiting-founder-decision` | Awaiting Founder approval |
| **Ready for Implementation** | `state: ready-for-implementation` | Approved and ready to claim |
| **Implementing** | `state: implementing` | Active development work |
| **Blocked** | `state: blocked` | Work is blocked by external factors |
| **Stopped Working** | `state: stopped-working` | Work was abandoned, available for claiming |
| **Testing** | `state: testing` | Under testing |
| **Verification** | `state: verification` | Final verification before closure |
| **Needs Rework** | `state: needs-rework` | Failed verification, needs fixes |
| **Failed Testing** | `state: failed-testing` | Failed testing, needs fixes |
| **Closed** | `state: closed` | Completed and verified |
| **Duplicate** | `state: duplicate` | Duplicate of another issue |

**Pros:**
- Complete visibility into workflow
- Matches state machine exactly
- Easy to see bottlenecks
- Better for larger teams

**Cons:**
- More columns to manage
- Can feel overwhelming initially

---

### Option 3: Hybrid 5-Column System (Balanced)

**Best for:** Balance between simplicity and visibility

| Column | Includes States | Description |
|--------|----------------|-------------|
| **Backlog** | discovered, triaged | Issues identified but not yet ready |
| **Planning** | needs-brainstorming, brainstorming, needs-founder-clarification, awaiting-founder-decision | Design and approval phase |
| **Ready** | ready-for-implementation, stopped-working | Ready to be claimed |
| **In Progress** | implementing, blocked, testing | Active work |
| **Done** | verification, closed, duplicate, needs-rework, failed-testing | Completed or closed |

**Pros:**
- Good balance of visibility and simplicity
- Groups related states logically
- Easier to scan than 16 columns

**Cons:**
- Loses some granularity
- Requires understanding of state groupings

---

## How to Configure the Board

### Step 1: Access Project Settings

1. Navigate to https://github.com/users/webwakaagent1/projects/1
2. Click the **⋯** menu in the top right
3. Select **Settings**

### Step 2: Configure Status Field

1. In the left sidebar, click on **Fields**
2. Find the **Status** field
3. Click **Edit**

### Step 3: Add/Modify Columns

For each column you want to add:

1. Click **+ Add option**
2. Enter the column name
3. Choose a color
4. Add a description (optional)
5. Click **Save**

To remove existing columns:

1. Click the **⋯** next to the column name
2. Select **Delete option**
3. Confirm deletion

### Step 4: Reorder Columns

Drag and drop columns to reorder them in the desired sequence (left to right represents the workflow flow).

---

## Automation Recommendations

GitHub Projects V2 supports automation workflows. Consider setting up:

### Auto-Add Issues

**Trigger:** When an issue is created in the repository  
**Action:** Add to project with status "Discovered"

### Auto-Archive Closed Issues

**Trigger:** When an issue is closed  
**Action:** Archive the item (optional)

### Status Sync with Labels

**Trigger:** When an issue label changes  
**Action:** Update the status column to match

**Note:** The state machine workflow already handles label management, so manual status sync may not be necessary.

---

## Current Status

**As of January 31, 2026:**

- ✅ Board is publicly accessible
- ✅ All 17 issues are added to the board
- ✅ Simple 3-column system is in place (Todo, In Progress, Done)
- ⚪ State-based columns are **not yet configured** (optional enhancement)

**Recommendation:** The current 3-column system is sufficient for initial operations. Consider upgrading to Option 2 or Option 3 if more granular visibility is needed as the team grows.

---

## Related Documentation

- [State Machine Documentation](./STATE_MACHINE.md) - Full state machine specification
- [Agent Onboarding Guide](./onboarding/AGENT_ONBOARDING.md) - How agents interact with the board
- [Founder Control Guide](./onboarding/FOUNDER_GUIDE.md) - How the Founder manages the board

---

**End of Guide**
