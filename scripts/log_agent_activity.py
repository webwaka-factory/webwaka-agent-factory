#!/usr/bin/env python3
"""
Agent Activity Logger

This script logs all agent activities to a centralized JSONL file.
It can be called from GitHub Actions workflows or by agents directly.

Usage:
    python3 log_agent_activity.py <action> <issue_number> [agent_id] [details]

Examples:
    python3 log_agent_activity.py claim 22 agent-1
    python3 log_agent_activity.py state_change 22 agent-1 "implementing -> testing"
    python3 log_agent_activity.py pr_created 22 agent-1 "PR #27"
"""

import json
import sys
from datetime import datetime
from pathlib import Path

# Log file location
LOG_FILE = Path(__file__).parent.parent / "logs" / "activity_log.jsonl"

def log_activity(action, issue_number, agent_id="unknown", details=""):
    """Log an agent activity to the centralized log file."""
    
    # Ensure logs directory exists
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    # Create log entry
    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "action": action,
        "issue_number": int(issue_number),
        "agent_id": agent_id,
        "details": details
    }
    
    # Append to log file (JSONL format - one JSON object per line)
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")
    
    print(f"✅ Logged: {action} on issue #{issue_number} by {agent_id}")
    return entry

def get_recent_activity(limit=100):
    """Get the most recent activity entries."""
    if not LOG_FILE.exists():
        return []
    
    with open(LOG_FILE, "r") as f:
        lines = f.readlines()
    
    # Return last N lines, parsed as JSON
    recent = []
    for line in lines[-limit:]:
        try:
            recent.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    
    return recent

def get_activity_for_issue(issue_number):
    """Get all activity for a specific issue."""
    if not LOG_FILE.exists():
        return []
    
    with open(LOG_FILE, "r") as f:
        lines = f.readlines()
    
    activities = []
    for line in lines:
        try:
            entry = json.loads(line)
            if entry.get("issue_number") == int(issue_number):
                activities.append(entry)
        except json.JSONDecodeError:
            continue
    
    return activities

def get_activity_for_agent(agent_id):
    """Get all activity for a specific agent."""
    if not LOG_FILE.exists():
        return []
    
    with open(LOG_FILE, "r") as f:
        lines = f.readlines()
    
    activities = []
    for line in lines:
        try:
            entry = json.loads(line)
            if entry.get("agent_id") == agent_id:
                activities.append(entry)
        except json.JSONDecodeError:
            continue
    
    return activities

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 log_agent_activity.py <action> <issue_number> [agent_id] [details]")
        print("\nActions:")
        print("  claim           - Agent claimed an issue")
        print("  abandon         - Agent abandoned an issue")
        print("  state_change    - Issue state changed")
        print("  pr_created      - Pull request created")
        print("  pr_merged       - Pull request merged")
        print("  comment         - Agent commented on issue")
        sys.exit(1)
    
    action = sys.argv[1]
    issue_number = sys.argv[2]
    agent_id = sys.argv[3] if len(sys.argv) > 3 else "unknown"
    details = sys.argv[4] if len(sys.argv) > 4 else ""
    
    log_activity(action, issue_number, agent_id, details)
