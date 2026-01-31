# Agent Onboarding Guide: WebWaka Agentic Software Factory

**Version:** 1.0  
**Date:** January 31, 2026

## 1. Welcome to the Factory

Welcome, Agent. You are now part of the WebWaka Agentic Software Factory, a fully automated, GitHub-native system for building and maintaining the WebWaka platform. This guide will provide you with everything you need to know to be a productive member of our multi-agent workforce.

Our core principle is simple but absolute:

> **GitHub is the single source of truth.** If it is not in a GitHub Issue, it is not a task. If its state is not represented by a label, its state is unknown. If an action is not in a comment or a commit, it did not happen.

Your compliance with the rules and workflows outlined in this document is mandatory. Adherence ensures system-wide observability, auditability, and scalability.

## 2. The Big Picture: How the Factory Works

The factory operates on a four-layer architecture. Understanding these layers will help you understand the context of your work.

| Layer | Purpose | Key Actors |
| :--- | :--- | :--- |
| **Discovery** | Identifies and proposes new tasks | All agents, automated monitors |
| **Task Intelligence** | Refines raw tasks into executable plans | Specialized planning agents |
| **Governance** | Provides human oversight and approval | The Founder |
| **Execution** | Implements and delivers the work | Implementation agents (like you) |

As an execution agent, you will primarily operate in the **Execution Layer**, but you may also participate in the **Discovery Layer** by identifying new bugs or proposing features.

## 3. The Task Lifecycle: From Idea to Done

Every task in our system is a GitHub Issue that progresses through a strict state machine. Here is a typical journey:

1.  **`discovered`**: An agent or monitor creates a new issue. The system automatically checks for duplicates.
2.  **`triaged`**: A planning agent assigns initial priority and domain labels.
3.  **`needs-brainstorming` / `awaiting-founder-decision`**: For complex tasks, a planning agent designs a solution and prepares it for the Founder's review.
4.  **`ready-for-implementation`**: The Founder approves the task by adding the `approved` label. The task is now fully specified and ready for you to work on.
5.  **`implementing`**: You claim the task. This is where you do the work.
6.  **`implemented`**: You open a Pull Request. The system automatically links it to the issue.
7.  **`testing`**: CI/CD runs automated tests.
8.  **`verification`**: Tests pass, and the task is ready for final QA or review.
9.  **`closed`**: The task is complete, verified, and merged.

For a detailed breakdown of every state, see the **[State Machine Specification](../STATE_MACHINE.md)**.

## 4. Your Workflow: A Step-by-Step Guide

As an execution agent, your primary workflow is as follows:

### Step 1: Find Work

Your work queue is the list of issues with the `state: ready-for-implementation` label. You can find these tasks here:

[**View Available Tasks**](https://github.com/webwakaagent1/webwaka-agent-factory/issues?q=is%3Aopen+is%3Aissue+label%3A%22state%3A+ready-for-implementation%22)

Before claiming a task, read the **Implementation Prompt** in the issue body carefully. Ensure you have the necessary skills and context to complete it.

### Step 2: Claim Your Task

Once you have chosen a task, you must claim it to prevent other agents from working on it. To do this, post a comment on the issue with the following command:

```
/claim
```

The system will assign the issue to you and transition its state to `implementing`.

### Step 3: Do the Work

Follow the instructions in the Implementation Prompt. Create a new branch for your work, write your code, and add any necessary tests. Adhere to all repository contribution guidelines.

### Step 4: Submit Your Work

When your implementation is complete and tested locally, open a Pull Request. **Your PR body must include a keyword that links it to the issue.**

**Example PR Body:**
```
Resolves #123

This PR implements the custom pricing tier feature as specified in the issue. All new code is covered by unit tests.
```

When you open the PR, the system will automatically transition the linked issue's state to `implemented`.

### Step 5: Handle Test Results

- **If CI tests pass**, the system will automatically move the issue to `state: testing`.
- **If CI tests fail**, the system will move the issue to `state: failed-testing` and unassign you. The task is now available for another agent to claim and fix.

## 5. Using Slash Commands

Slash commands are your primary way of interacting with the factory's state machine. You use them by posting comments on an issue.

| Command | Purpose |
| :--- | :--- |
| `/claim` | Claim an available task. |
| `/state <new-state>` | Request a state transition (e.g., `/state blocked`). |
| `/abandon` | Abandon a task you have claimed. |
| `/duplicate #<issue>` | Mark an issue as a duplicate. |

For a complete list of commands, syntax, and examples, you **must** read the **[Slash Commands Reference](../SLASH_COMMANDS.md)**.

## 6. Rules of Engagement (Best Practices)

Adherence to these rules is not optional. It is critical for the smooth operation of the factory.

1.  **One Task at a Time:** Do not claim a new task until your current task is in a terminal state (`closed`) or has been successfully handed off (`failed-testing`, `stopped-working`).
2.  **Communicate Clearly:** When changing state, especially to `blocked` or `abandon`, your comment must explain **why**. Provide enough context for the next agent to understand the situation.
3.  **Do Not Work on Unclaimed Tasks:** If a task is not assigned to you, you must not work on it. All work must be traceable to an agent.
4.  **Respect the State Machine:** Do not attempt invalid state transitions. If a command fails, read the error message. It will tell you why.
5.  **Link Your PRs Correctly:** If you do not include `Resolves #123` (or a similar keyword) in your PR body, the system cannot link your work, and the task will not advance.
6.  **Own Your Work:** Your goal is to get a task to `closed`. If a task you worked on moves to `needs-rework`, it is your responsibility to understand why and learn from the feedback.

## 7. Troubleshooting

| Problem | Solution |
| :--- | :--- |
| My `/claim` command failed. | The issue is likely already assigned or not in the `ready-for-implementation` state. Check the labels and assignee. |
| My `/state` command failed. | You are attempting an invalid transition. Read the error message and consult the [State Machine Specification](../STATE_MACHINE.md). |
| I opened a PR, but the issue state didn't change. | You forgot to include `Resolves #<issue-number>` in your PR body. Edit the PR body to include it. |
| I'm blocked and don't know what to do. | Post a comment with `/state blocked` and clearly explain the blocker. Another agent or the Founder may be able to help. |

## 8. Glossary

- **Agentic Software Factory:** The automated system you are a part of.
- **Implementation Prompt:** The detailed, step-by-step instructions within a GitHub Issue that describe the work to be done.
- **State Machine:** The set of rules that govern the lifecycle of a task.
- **Slash Command:** A command (e.g., `/claim`) posted in an issue comment to interact with the system.
- **Founder:** The human authority responsible for governance and approvals.

---

**You have been onboarded. Your primary objective is to find tasks in `ready-for-implementation` and move them to `closed`. Good luck, Agent.**
