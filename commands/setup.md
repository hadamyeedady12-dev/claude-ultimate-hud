---
description: Configure claude-ultimate-hud as your statusline
argument-hint: "[language] [plan]"
allowed-tools: Bash, Read, Edit, Write, AskUserQuestion
user-invocable: false
---

# Claude Ultimate HUD Setup

Configure the claude-ultimate-hud status line plugin with automatic runtime and platform detection.

## Step 0: Ask User Preferences (if not provided via arguments)

Use `AskUserQuestion` to ask for both language and plan in a **single call** (up to 2 questions):

**Question 1 - Language** (if `$1` not provided):
- header: "Language"
- question: "Which language do you prefer for the HUD?"
- options:
  - `en`: English (Recommended)
  - `ko`: Korean (한국어)
  - `auto`: Auto-detect from system locale

**Question 2 - Plan** (if `$2` not provided):
- header: "Plan"
- question: "Which subscription plan are you on?"
- options:
  - `max200`: Max $200/mo (20x) - 5h + 7d all + 7d Sonnet (Recommended)
  - `max100`: Max $100/mo (5x) - 5h + 7d all + 7d Sonnet
  - `pro`: Pro - 5h only
  - `enterprise`: Enterprise - Cost in $ + 5h

Use the selected values for the rest of the setup.

## Arguments (optional, skips interactive selection)

- `$1`: Language preference
  - `auto` (default): Detect from system language
  - `en`: English
  - `ko`: Korean (한국어)

- `$2`: Subscription plan
  - `pro`: Shows 5h rate limit only
  - `max100`: Shows 5h + 7d all + 7d Sonnet (Max $100/월 플랜)
  - `max200` (default): Shows 5h + 7d all + 7d Sonnet (Max $200/월 플랜)
  - `enterprise`: Shows cost in $ + 5h rate limit (Enterprise 플랜)

## Step 1: Detect Platform & Runtime

**macOS/Linux** (if `uname -s` returns "Darwin", "Linux", or MINGW*/MSYS*/CYGWIN*):

1. Get plugin path (check cache/marketplace first, then manual install):
   ```bash
   ls -td ~/.claude/plugins/cache/claude-ultimate-hud/claude-ultimate-hud/*/ 2>/dev/null | head -1 || ls -d ~/.claude/plugins/claude-ultimate-hud/ 2>/dev/null
   ```
   If empty, plugin is not installed.

2. Get runtime absolute path (prefer bun, fallback to node):
   ```bash
   command -v bun 2>/dev/null || command -v node 2>/dev/null
   ```
   If empty, tell user to install Node.js or Bun.

3. Determine source file based on runtime:
   - If runtime is `bun`: use `src/index.ts`
   - Otherwise: use `dist/index.js`

4. Generate command with dynamic path detection:
   ```
   bash -c '"{RUNTIME_PATH}" "$(ls -td ~/.claude/plugins/cache/claude-ultimate-hud/claude-ultimate-hud/*/ 2>/dev/null | head -1 || ls -d ~/.claude/plugins/claude-ultimate-hud/ 2>/dev/null){SOURCE}"'
   ```

**Windows** (native PowerShell - if `uname` is not available):

1. Get plugin path:
   ```powershell
   $cache = "$env:USERPROFILE\.claude\plugins\cache\claude-ultimate-hud\claude-ultimate-hud"
   $manual = "$env:USERPROFILE\.claude\plugins\claude-ultimate-hud"
   if (Test-Path $cache) { (Get-ChildItem $cache | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName } elseif (Test-Path $manual) { $manual }
   ```

2. Get runtime:
   ```powershell
   if (Get-Command bun -ErrorAction SilentlyContinue) { (Get-Command bun).Source } elseif (Get-Command node -ErrorAction SilentlyContinue) { (Get-Command node).Source }
   ```

3. Source file: `src\index.ts` for bun, `dist\index.js` otherwise.

4. Generate PowerShell command:
   ```
   powershell -Command "& {$cache='$env:USERPROFILE\.claude\plugins\cache\claude-ultimate-hud\claude-ultimate-hud';$manual='$env:USERPROFILE\.claude\plugins\claude-ultimate-hud';$p=if(Test-Path $cache){(Get-ChildItem $cache|Sort-Object LastWriteTime -Descending|Select-Object -First 1).FullName}else{$manual}; & '{RUNTIME_PATH}' (Join-Path $p '{SOURCE}')}"
   ```

## Step 2: Create Configuration File

Create `~/.claude/claude-ultimate-hud.local.json`:

```json
{
  "language": "{$1 or auto}",
  "plan": "{$2 or max200}",
  "cache": {
    "ttlSeconds": 60
  }
}
```

## Step 3: Test Command

Run the generated command to verify it works:
- Should output HUD lines within a few seconds
- If error or hang, debug before proceeding

## Step 4: Apply Configuration

Read `~/.claude/settings.json` (or `$env:USERPROFILE\.claude\settings.json` on Windows).
Merge the statusLine config, preserving existing settings:

```json
{
  "statusLine": {
    "type": "command",
    "command": "{GENERATED_COMMAND}"
  }
}
```

## Step 5: Verify

The HUD should appear below the input field on the next message.

**Example Output:**
```
🤖 Opus 4.5 │ ████░░░░░░ 25% │ 50K/200K │ 5h: 12% (3h59m) │ 7d: 전체 18% │ 소넷 1%
📁 my-project git:(main) │ 2 CLAUDE.md │ 6 MCPs │ ⏱️ 1h30m
```

## Troubleshooting

**"command not found"**:
- Runtime path changed (mise/nvm/asdf update)
- Re-run setup to detect new path

**Plugin not found**:
- Install via: `/plugin marketplace add hadamyeedady12-dev/claude-ultimate-hud`

**Windows "bash not recognized"**:
- Use PowerShell command variant

**Permission denied**:
- `chmod +x {RUNTIME_PATH}` on macOS/Linux

## Plan Differences

| Feature | pro | max100 | max200 | enterprise |
|---------|-----|--------|--------|------------|
| 5h rate limit | ✅ | ✅ | ✅ | ✅ |
| 7d all models | ❌ | ✅ | ✅ | ❌ |
| 7d Sonnet | ❌ | ✅ | ✅ | ❌ |
| Cost ($) | ❌ | ❌ | ❌ | ✅ |

### Rate Limits by Plan

| Plan | 5시간 | 주간 Sonnet | 주간 Opus |
|------|-------|-------------|-----------|
| Max $100 (5x) | ~225 메시지 | 140-280시간 | 15-35시간 |
| Max $200 (20x) | ~900 메시지 | 240-480시간 | 24-40시간 |
