---
description: Configure claude-ultimate-hud status line settings
argument-hint: "[language] [plan]"
allowed-tools: Read, Write, Bash(jq:*), Bash(cat:*), Bash(mkdir:*)
---

# Claude Ultimate HUD Setup

Configure the claude-ultimate-hud status line plugin.

## Arguments

- `$1`: Language preference
  - `auto` (default): Detect from system language
  - `en`: English
  - `ko`: Korean

- `$2`: Subscription plan
  - `max` (default): Shows 5h + 7d (all models) + 7d-S (Sonnet)
  - `pro`: Shows 5h only

## Tasks

### 1. Create configuration file

Create `~/.claude/claude-ultimate-hud.local.json` with user preferences:

```json
{
  "language": "$1 or auto",
  "plan": "$2 or max",
  "cache": {
    "ttlSeconds": 60
  }
}
```

### 2. Update settings.json

Add or update the statusLine configuration in `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bun ${HOME}/.claude/plugins/claude-ultimate-hud/dist/index.js"
  }
}
```

### 3. Verify setup

After configuration:
1. Check that the configuration file was created successfully
2. Verify the settings.json was updated
3. Inform the user that the status line will appear on the next message

### 4. Show example output

Display what the status line will look like:

**Line 1 - Session:**
```
🤖 Opus │ ████████░░ 80% │ 160K/200K │ $1.25 │ 5h: 42% (2h30m) │ 7d: 69% │ 7d-S: 2%
```

**Line 2 - Project:**
```
📁 my-project git:(main) │ 2 CLAUDE.md │ 8 rules │ 6 MCPs │ 6 hooks │ ⏱️ 1h30m
```

**Line 3 - Tools (when active):**
```
◐ Read: file.ts │ ✓ Bash ×5 │ ✓ Edit ×3
```

**Line 4 - Agents (when active):**
```
◐ explore: Finding patterns... │ ✓ librarian (2s)
```

**Line 5 - Todos (when active):**
```
▸ Implement auth flow (2/5)
```

## Notes

- If no arguments provided, use defaults (auto language, max plan)
- The status line will start working immediately after configuration
- To change settings later, run this command again with new arguments
