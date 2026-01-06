# claude-ultimate-hud

Ultimate status line plugin for Claude Code - combines the best of [claude-dashboard](https://github.com/uppinote20/claude-dashboard) and [claude-hud](https://github.com/jarrodwatts/claude-hud).

## Features

### From claude-dashboard
- 🤖 **Model Display**: Current model (Opus, Sonnet, Haiku)
- 📊 **Progress Bar**: Color-coded context usage (green → yellow → red)
- 📈 **Token Count**: Current/total tokens (K/M format)
- 💰 **Cost Tracking**: Session cost in USD
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
🤖 Opus 4.5 │ ████░░░░░░ 18% │ 37K/200K │ $0.04 │ 5h: 12% (3h59m) │ 7d: 18% │ 7d-S: 1%
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
| plan | `max`, `pro` | `max` |

Examples:
```
/claude-ultimate-hud:setup ko max   # Korean, Max plan
/claude-ultimate-hud:setup en pro   # English, Pro plan
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

| Feature | Max | Pro |
|---------|-----|-----|
| 5h rate limit | ✅ | ✅ |
| Reset countdown | ✅ | ✅ |
| 7d all models | ✅ | ❌ |
| 7d Sonnet only | ✅ | ❌ |

## Credits

This plugin combines features from:
- [claude-dashboard](https://github.com/uppinote20/claude-dashboard) by uppinote
- [claude-hud](https://github.com/jarrodwatts/claude-hud) by Jarrod Watts

## License

MIT
