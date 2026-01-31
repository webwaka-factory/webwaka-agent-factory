# Founder Walkthrough: WebWaka Agentic Software Factory

**Version:** 1.0  
**Date:** January 31, 2026

## 1. Introduction

This document provides a guided walkthrough of the fully operational WebWaka Agentic Software Factory. It will demonstrate how to use the system to govern work, monitor progress, and audit activity.

## 2. Walkthrough Scenario

We will follow a single task through its entire lifecycle, from creation to completion, demonstrating your role and the system's automated responses at each stage.

**Scenario:** An agent discovers a critical bug in the pricing engine.

### Step 1: Task Creation (Discovery Layer)

An agent discovers the bug and creates a new issue using the "Bug Report" template.

1.  **Action:** An agent creates a new issue titled "[BUG] Critical Pricing Error on Multi-Tier Tenants".
2.  **System Response:**
    - The issue is automatically assigned the `state: discovered` and `type: bug` labels.
    - The Duplicate Detection workflow runs and posts a comment if similar issues are found.

**What you see:** A new issue appears in the repository.

### Step 2: Triage & Brainstorming (Task Intelligence Layer)

A planning agent picks up the task.

1.  **Action:** A planning agent comments `/state triaged` and adds the `priority: critical` label.
2.  **System Response:** The state is updated to `triaged`.
3.  **Action:** The agent determines this is complex and comments `/state needs-brainstorming`.
4.  **System Response:** The state is updated.
5.  **Action:** The agent designs a fix, documents it in the issue body, and comments `/state awaiting-founder-decision`.

**What you see:** The issue now appears in your primary queue.

### Step 3: Your Decision (Governance Layer)

This is your key interaction point.

1.  **Action:** You navigate to the issue. You review the Implementation Prompt and agree with the proposed fix.
2.  **Action:** You add the `approved` label to the issue.
3.  **System Response:** The State Machine workflow validates that this transition is allowed and moves the issue to `state: ready-for-implementation`.

**What you see:** The issue is now available in the public work queue for any execution agent to claim.

### Step 4: Implementation (Execution Layer)

An execution agent claims the task.

1.  **Action:** An agent comments `/claim`.
2.  **System Response:**
    - The issue is assigned to the agent.
    - The state is updated to `implementing`.
3.  **Action:** The agent writes the code and opens a Pull Request with "Resolves #<issue-number>" in the body.
4.  **System Response:**
    - The state is updated to `implemented`.
    - The CI/CD pipeline is triggered.

**What you see:** You can see the task is `implementing` and assigned to a specific agent on the Project Board. You can also see the linked PR.

### Step 5: Testing & Verification

The system handles this automatically.

1.  **System Action:** The CI tests complete successfully.
2.  **System Response:** The state is updated to `state: testing`.
3.  **Action:** A QA agent (or another designated verifier) performs final checks and comments `/state verification`.
4.  **System Response:** The state is updated to `verification`.
5.  **Action:** The PR is merged.
6.  **Action:** The verifier comments `/state closed`.
7.  **System Response:**
    - The state is updated to `closed`.
    - The issue is automatically closed.

**What you see:** The task moves to the "Done" column on the Project Board. The entire history of the task, from creation to closure, is available in the issue's comments.

## 3. Demonstrating Visibility, Control, and Auditability

### Visibility: "Who is working on what?"

- **Tool:** [Agent Factory Kanban Board](https://github.com/users/webwakaagent1/projects/1)
- **How:** The board provides a real-time, drag-and-drop view of all tasks. The "Implementing" column shows every task currently being worked on and who it is assigned to.

- **Tool:** [Daily Status Report](https://github.com/webwakaagent1/webwaka-agent-factory/issues?q=is%3Aopen+is%3Aissue+label%3Areport)
- **How:** The "Active Agents" section of the daily report lists every agent with assigned tasks.

### Control: "How do I stop or change something?"

- **To Stop a Task:**
    - **Action:** Add the `wont-fix` label to any issue before it is `closed`.
    - **Effect:** The issue will be closed, and agents will not be able to work on it.
- **To Change a Task:**
    - **Action:** For an `approved` task, post a comment detailing the required change and @-mention the assigned agent.
    - **Effect:** The agent will see your comment and can transition the task to `blocked` or `stopped-working` to incorporate the changes. For significant changes, it's best to create a new issue.
- **To Prioritize Work:**
    - **Action:** Add or change the `priority:*` labels on issues in the `ready-for-implementation` queue.
    - **Effect:** Agents are instructed to prioritize tasks with higher priority labels.

### Auditability: "What happened to this task?"

- **Tool:** Any GitHub Issue in the repository.
- **How:** The entire history of a task is recorded as a linear sequence of comments.
    - **State Changes:** Every state transition is logged by the system with a timestamp and the responsible actor.
    - **Decisions:** Your approval is recorded when you add the `approved` label. Agent decisions (like abandoning a task) are recorded in their comments.
    - **Code Changes:** The linked Pull Request provides a complete diff of all code that was changed.
    - **Discussions:** All conversations about the task happen in one place.

## 4. Live Demonstration Plan

To provide a live demonstration, we will perform the following steps:

1.  **Create a Test Issue:** I will create a sample bug report issue.
2.  **Guide You Through Approval:** I will guide you to find the issue and add the `approved` label.
3.  **Simulate Agent Work:** I will act as the agent, claiming the task, opening a PR, and moving it through the states.
4.  **Review the Results:** We will review the completed issue, the Project Board, and the daily report together.

This will give you hands-on experience with the system and confirm its functionality.

## 5. Conclusion

The WebWaka Agentic Software Factory provides you with complete visibility, control, and auditability over the entire software development lifecycle, while automating the repetitive tasks of coordination and state management. Your role is elevated from a manager to a strategic governor, allowing you to focus on what matters most: the direction of the platform.

---

**This concludes the Founder Walkthrough. The system is now ready for your final ratification.**
your final ratification.**
our review and ratification.**
and ratification.**
