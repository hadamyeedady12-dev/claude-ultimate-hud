---
name: release
description: |
  Automates the full claude-ultimate-hud release pipeline: builds the project, bumps version across all manifests, updates Korean and English READMEs with generated changelogs, commits and pushes, creates a GitHub release, and cleans local caches. Use when cutting a new plugin version, publishing a release to the marketplace, or running the end-to-end ship workflow from version bump through GitHub release.
argument-hint: "[version] [description]"
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, AskUserQuestion
user-invocable: true
disable-model-invocation: true
---

# claude-ultimate-hud Release Workflow

Runs the full release pipeline for a new plugin version — from build through GitHub release and cache cleanup.

## Arguments

- `$0`: New version number (e.g. `1.6.0`). Prompts user if omitted.
- `$1~`: One-line release description (e.g. `API stability & git extensions`). Auto-generated from diff if omitted.

## Pre-check

1. Confirm working directory is the `claude-ultimate-hud` plugin root.
   - If not, switch to `~/.claude/plugins/claude-ultimate-hud` or the marketplace cache path.
2. Run `git status` to inspect current state.
3. If there are no changes, notify the user and stop.

## Step 1: Gather Info

If version is not provided via `$0`, ask with `AskUserQuestion`:
- header: `"Version"`
- question: `"Enter new version number (current: {current package.json version})"`

If no release description is provided, analyze `git diff HEAD --stat` and changed source files to auto-generate a one-line title and changelog.

## Step 2: Build

```bash
bun run build
```

Stop if the build fails.

## Step 3: Version Bump

Update version to `$0` in these three files:

1. **`package.json`** — `"version"` field
2. **`.claude-plugin/plugin.json`** — `metadata.version`
3. **`.claude-plugin/marketplace.json`** — `metadata.version`

## Step 4: Update READMEs

### 4-1. README.md (Korean)

Under `## 기능`, insert a new version highlight **above** the current latest entry:

```markdown
### v{VERSION} - {one-line description}
- Key change items (extracted from git diff)
```

Update the `## 출력 예시` code block to reflect new features (only if changed).

Add detailed changelog at the top of `## 변경 이력`:

```markdown
### v{VERSION}
- Change items (specific and technical)
```

### 4-2. README.en.md (English)

Mirror the same structure in English. Translate Korean changelog entries to English.

### Changelog Rules

- Derive entries from `git diff HEAD` or committed changes.
- Prefix each entry with an appropriate emoji:
  - 🔒 security/stability, 🌿 git, 📊 data/display, 🔥 performance
  - 📝 code changes, 🔍 debug/tracing, 📋 features, 📏 UI
  - ⚙️ config, 📦 build/files, 🛡️ validation, ❄️ cache
- Group by change type (API, Git, UI, Config, etc.).
- Be specific — avoid vague terms like "improved" or "updated".

## Step 5: Rebuild dist

Rebuild after README/metadata changes, as dist may have changed:

```bash
bun run build
```

## Step 6: Commit

**Commit 1** — source changes (if unstaged):
```
feat: upgrade to v{VERSION} — {one-line description}

{detailed change summary}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Commit 2** — README/metadata:
```
docs: add v{VERSION} changelog, update marketplace and plugin metadata

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

If all source and docs changes can be committed together, use a single commit.

## Step 7: Push

```bash
git push origin main
```

If push is rejected, run `git pull --rebase origin main` first. On rebase conflict, resolve with `git checkout --theirs` to prefer local code.

## Step 8: GitHub Release

```bash
gh release create v{VERSION} \
  --title "v{VERSION} — {one-line description}" \
  --notes "$(cat <<'EOF'
## What's New

{Changes organized by phase or category}

### Output Example

```
{HUD output sample}
```

### Files Changed
- {N} files modified, {N} new, {N} deleted
- Bundle size: {dist/index.js size}

**Full Changelog**: https://github.com/hadamyeedady12-dev/claude-ultimate-hud/compare/v{PREV}...v{VERSION}
EOF
)"
```

## Step 9: Clean Local Cache & Rebuild

```bash
rm -f ~/.claude/claude-ultimate-hud-cache.json \
      ~/.claude/claude-ultimate-hud-ncache.json \
      ~/.claude/claude-ultimate-hud-git-cache.json \
      ~/.claude/claude-ultimate-hud-transcript-cache.json \
      ~/.claude/claude-ultimate-hud-config-cache.json \
      ~/.claude/claude-ultimate-hud-speed-cache.json \
      ~/.claude/claude-ultimate-hud-usage.lock

bun install && bun run build
```

## Step 10: Verify

Run a final smoke test:

```bash
echo '{"model":{"display_name":"Opus"},"cwd":"'$(pwd)'","transcript_path":"","context_window":{"context_window_size":200000,"current_usage":{"input_tokens":50000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}},"cost":{"total_cost_usd":0.5}}' | bun dist/index.js
```

If output looks correct, display the release URL and confirm completion.

## Summary Template

```
v{VERSION} release complete:
1. Build        — {bundle size}
2. Version bump — package.json, plugin.json, marketplace.json
3. README       — KO/EN changelog added
4. Commit       — {N} commit(s) ({hash})
5. Push         — origin/main
6. Release      — {release URL}
7. Cache cleanup & rebuild — done
```
