# claude-ultimate-hud

[English](README.md) | [한국어](README.ko.md)

Ultimate status line plugin for Claude Code - combines the best of [claude-dashboard](https://github.com/uppinote20/claude-dashboard) and [claude-hud](https://github.com/jarrodwatts/claude-hud).

![Screenshot](assets/screenshot.png)

## Features

### From claude-dashboard
- 🤖 **Model Display**: Current model (Opus, Sonnet, Haiku)
- 📊 **Progress Bar**: Color-coded context usage (green → yellow → red)
- 📈 **Token Count**: Current/total tokens (K/M format)
- ⏱️ **Rate Limits**: 5h/7d limits with reset countdown

### From claude-hud
- 📁 **Project Info**: Directory name with git branch
- 📋 **Config Counts**: CLAUDE.md, rules, MCPs, hooks
- ⏱️ **Session Duration**: How long you've been working
- 🔧 **Tool Activity**: Running/completed tools with counts
- 🤖 **Agent Status**: Subagent progress tracking
- ✅ **Todo Progress**: Current task and completion rate

### Additional
- 🌐 **i18n**: English and Korean support (auto-detect)

## Output Example

```
🤖 Opus 4.5 │ ████░░░░░░ 18% │ 37K/200K │ 5h: 12% (3h59m) │ 7d(all): 18% │ 7d(Sonnet): 1%
📁 my-project git:(main) │ 2 CLAUDE.md │ 8 rules │ 6 MCPs │ 6 hooks │ ⏱️ 1h30m
◐ Read: file.ts │ ✓ Bash ×5 │ ✓ Edit ×3
◐ explore: Finding patterns... │ ✓ librarian (2s)
▸ Implement auth flow (2/5)
```

## Installation

### From Plugin Marketplace

```
/plugin marketplace add hadamyeedady12-dev/claude-ultimate-hud
/plugin install claude-ultimate-hud
/claude-ultimate-hud:setup
```

> **Note**: Marketplace installs to `~/.claude/plugins/cache/claude-ultimate-hud/`

### Manual Installation

```bash
git clone https://github.com/hadamyeedady12-dev/claude-ultimate-hud.git ~/.claude/plugins/claude-ultimate-hud
cd ~/.claude/plugins/claude-ultimate-hud
bun install && bun run build
```

Then run:
```
/claude-ultimate-hud:setup
```

## Configuration

```
/claude-ultimate-hud:setup [language] [plan]
```

| Argument | Options | Default |
|----------|---------|---------|
| language | `auto`, `en`, `ko` | `auto` |
| plan | `pro`, `max100`, `max200` | `max200` |

Examples:
```
/claude-ultimate-hud:setup ko max100   # Korean, Max $100 plan
/claude-ultimate-hud:setup en pro      # English, Pro plan
/claude-ultimate-hud:setup auto max200 # Auto language, Max $200 plan
```

## Requirements

- **Claude Code** v1.0.80+
- **Bun** or **Node.js** 18+

## Color Legend

| Color | Usage % | Meaning |
|-------|---------|---------|
| 🟢 Green | 0-50% | Safe |
| 🟡 Yellow | 51-80% | Warning |
| 🔴 Red | 81-100% | Critical |

## Plan Differences

| Feature | pro | max100 | max200 |
|---------|-----|--------|--------|
| 5h rate limit | ✅ | ✅ | ✅ |
| Reset countdown | ✅ | ✅ | ✅ |
| 7d all models | ❌ | ✅ | ✅ |
| 7d Sonnet only | ❌ | ✅ | ✅ |

### Rate Limits Detail

| Plan | 5-hour | Weekly Sonnet | Weekly Opus |
|------|--------|---------------|-------------|
| Max $100 (5x) | ~225 messages | 140-280 hours | 15-35 hours |
| Max $200 (20x) | ~900 messages | 240-480 hours | 24-40 hours |

## Credits

This plugin combines features from:
- [claude-dashboard](https://github.com/uppinote20/claude-dashboard) by uppinote
- [claude-hud](https://github.com/jarrodwatts/claude-hud) by Jarrod Watts

Special thanks to **별아해 (byeorahae)** for valuable feedback and bug fixes.

Built with [OhMyOpenCode](https://github.com/anthropics/claude-code).

## License

MIT
