# Founder Control Guide: WebWaka Agentic Software Factory

**Version:** 1.0  
**Date:** January 31, 2026

## 1. Introduction

This document outlines your role as the **Founder**, the sole human governance authority within the WebWaka Agentic Software Factory. The system is designed to be fully autonomous, but your strategic input and approval are the critical gates that control the flow of work.

Your primary responsibility is not to manage the agents, but to **govern the work**. The system handles the rest.

## 2. Your Role: The Decider

As the Founder, you have three primary functions within the factory:

1.  **Approve Work:** You decide which tasks are implemented.
2.  **Provide Clarification:** You answer questions that only you can answer.
3.  **Monitor Progress:** You have complete visibility into the factory's operations.

## 3. The Governance Workflow

Your interaction with the system is focused on a single state: `awaiting-founder-decision`.

### Step 1: Identify Tasks Awaiting Your Decision

Your primary queue is the list of issues with the `state: awaiting-founder-decision` label. These are tasks that the Task Intelligence Layer has fully prepared and are now ready for your strategic review.

[**View Tasks Awaiting Your Decision**](https://github.com/webwaka-factory/webwaka-agent-factory/issues?q=is%3Aopen+is%3Aissue+label%3A%22state%3A+awaiting-founder-decision%22)

### Step 2: Review the Proposal

For each issue in this queue, review the **Implementation Prompt** in the issue body. This prompt contains:
- The objective of the task
- The proposed solution
- The scope and non-goals
- Any associated risks or trade-offs

### Step 3: Make a Decision

You have two primary actions you can take:

#### To Approve a Task:

1.  Add the `approved` label to the issue.

That's it. The system will automatically transition the issue to `state: ready-for-implementation`, where it will be picked up by an execution agent.

#### To Reject a Task:

1.  Add the `wont-fix` label to the issue.
2.  (Optional but recommended) Post a comment explaining your reasoning.

This will close the issue and remove it from the active work queue.

### Handling Clarifications

Occasionally, an agent may need your input to proceed. These tasks will be in the `state: needs-founder-clarification` state and will have you @-mentioned in a comment with specific questions.

1.  **Find these tasks:** [View Tasks Needing Clarification](https://github.com/webwaka-factory/webwaka-agent-factory/issues?q=is%3Aopen+is%3Aissue+label%3A%22state%3A+needs-founder-clarification%22)
2.  **Provide your answer** in a comment.
3.  The agent will then incorporate your feedback and move the task to `awaiting-founder-decision` for your final approval.

## 4. Observability: Your Control Panel

You have several tools to monitor the factory's health and progress.

### The Project Board

The **[Agent Factory Kanban Board](https://github.com/users/webwakaagent1/projects/1)** provides a real-time, high-level overview of all work in progress. You can see at a glance:
- What is being worked on (`implementing`)
- What is blocked (`blocked`)
- What is ready for your review (`awaiting-founder-decision`)

### Daily Status Reports

Every day, the system will automatically generate a **Daily Status Report** and post it as an issue with the `report` label. This report contains detailed metrics on:
- Issues by state
- Active agents and their tasks
- A list of all blocked tasks and why they are blocked
- A list of tasks that failed testing and need rework
- A priority breakdown of all open tasks

[**View All Reports**](https://github.com/webwaka-factory/webwaka-agent-factory/issues?q=is%3Aopen+is%3Aissue+label%3Areport)

### Searching and Filtering

You can use GitHub's standard search and filtering capabilities to ask specific questions. For example:

- **Show me all critical bugs:** `is:open is:issue label:
