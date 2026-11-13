# Agent sidebar

A pane that sits beside the Claude chat and lists every AI business agent: a status dot, the business it runs, its current task, and profit today and all time. It refreshes every 5 seconds. Tap an agent to expand it and press "Brief me" to have Claude brief you on it.

Data: it reads `/mnt/project-files/agent-sidebar/agents.json` (or `~/.claude/agent-sidebar/agents.json`). Until that file exists it shows clearly labelled demo data. Format: `{ "agents": [{ "id", "name", "business", "status": "running|idle|waiting|error", "task", "profitToday", "profitTotal" }] }`.

Reopen it with `/agent-sidebar`.

## Install

At the prompt of any Claude Code session:

```
/plugin install agent-sidebar --marketplace rjmarcum755/claude-agent-sidebar
```

Answer `y` to add the marketplace, then pick a scope (user scope puts it in every session).
