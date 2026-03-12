---
name: release
description: Build, version bump, update README/marketplace, commit, push, create GitHub release, and clean local caches
argument-hint: "[version] [description]"
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, AskUserQuestion
user-invocable: true
disable-model-invocation: true
---

# claude-ultimate-hud Release Workflow

새 버전을 릴리즈하는 전체 워크플로우를 자동 실행합니다.

## Arguments

- `$0`: 새 버전 번호 (예: `1.6.0`). 생략 시 사용자에게 질문합니다.
- `$1~`: 릴리즈 한줄 설명 (예: `API stability & git extensions`). 생략 시 자동 생성합니다.

## Pre-check

1. 작업 디렉토리가 `claude-ultimate-hud` 플러그인 루트인지 확인합니다.
   - 아니면 `cd ~/.claude/plugins/claude-ultimate-hud` 또는 마켓플레이스 캐시 경로로 이동합니다.
2. `git status`로 현재 상태를 확인합니다.
3. 변경 사항이 없으면 사용자에게 알리고 중단합니다.

## Step 1: Gather Info

버전이 `$0`으로 제공되지 않으면 `AskUserQuestion`으로 물어봅니다:
- header: "Version"
- question: "새 버전 번호를 입력하세요 (현재: {현재 package.json 버전})"

릴리즈 설명이 없으면 `git diff HEAD --stat`과 변경된 소스 파일을 분석해서 한줄 제목과 changelog를 자동 생성합니다.

## Step 2: Build

```bash
bun run build
```

빌드 실패 시 중단합니다.

## Step 3: Version Bump

아래 3개 파일에서 버전을 `$0`으로 업데이트합니다:

1. **`package.json`**: `"version": "{OLD}"` → `"version": "{NEW}"`
2. **`.claude-plugin/plugin.json`**: `metadata.version`
3. **`.claude-plugin/marketplace.json`**: `metadata.version`

## Step 4: Update README

### 4-1. README.md (한국어)

`## 기능` 섹션 아래, 기존 최신 버전 항목 **위에** 새 버전 feature highlight를 추가합니다:

```markdown
### v{VERSION} - {한줄 설명}
- 주요 변경 사항 목록 (git diff에서 추출)
```

`## 출력 예시` 섹션의 코드 블록을 새 기능이 반영된 예시로 업데이트합니다 (변경 필요시에만).

`## 변경 이력` 섹션 맨 위에 상세 changelog를 추가합니다:

```markdown
### v{VERSION}
- 변경 항목들 (구체적, 기술적)
```

### 4-2. README.en.md (English)

동일한 구조로 영문 README도 업데이트합니다. 한국어 changelog를 영어로 번역하여 추가합니다.

### Changelog 작성 규칙

- `git diff HEAD` 또는 커밋된 변경 사항을 분석하여 changelog를 생성합니다.
- 각 항목은 적절한 이모지 prefix를 사용합니다:
  - 🔒 보안/안정성, 🌿 Git, 📊 데이터/표시, 🔥 성능
  - 📝 코드 변경, 🔍 디버그/추적, 📋 기능, 📏 UI
  - ⚙️ 설정, 📦 빌드/파일, 🛡️ 검증, ❄️ 캐시
- 변경 유형별로 그룹핑합니다 (API, Git, UI, Config 등).
- 짧고 구체적으로 작성합니다 — "개선" 같은 모호한 표현 금지.

## Step 5: Rebuild dist

README/metadata 변경 후 dist가 변경되었을 수 있으므로 리빌드합니다:

```bash
bun run build
```

## Step 6: Commit

**커밋 1** — 소스 변경 (이미 unstaged인 경우):
```
feat: upgrade to v{VERSION} — {한줄 설명}

{상세 변경 사항 요약}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**커밋 2** — README/메타데이터:
```
docs: add v{VERSION} changelog, update marketplace and plugin metadata

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

모든 소스+docs가 한 번에 커밋 가능하면 1개 커밋으로 통합해도 됩니다.

## Step 7: Push

```bash
git push origin main
```

push가 rejected되면 `git pull --rebase origin main`을 먼저 실행합니다.
rebase 충돌 시 `git checkout --theirs`로 우리 코드를 우선합니다.

## Step 8: GitHub Release

`gh release create` 명령으로 릴리즈를 생성합니다:

```bash
gh release create v{VERSION} \
  --title "v{VERSION} — {한줄 설명}" \
  --notes "$(cat <<'EOF'
## What's New

{Phase별 또는 카테고리별 변경 사항}

### Output Example

```
{HUD 출력 예시}
```

### Files Changed
- {변경 파일 수} files modified, {신규 파일} new, {삭제 파일} deleted
- Bundle size: {dist/index.js 크기}

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

최종 동작 테스트를 실행합니다:

```bash
echo '{"model":{"display_name":"Opus"},"cwd":"'$(pwd)'","transcript_path":"","context_window":{"context_window_size":200000,"current_usage":{"input_tokens":50000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}},"cost":{"total_cost_usd":0.5}}' | bun dist/index.js
```

출력이 정상이면 릴리즈 URL을 사용자에게 보여주고 완료를 알립니다.

## Summary Template

작업 완료 후 아래 형식으로 요약합니다:

```
v{VERSION} 릴리즈 완료:
1. Build — {번들 크기}
2. Version bump — package.json, plugin.json, marketplace.json
3. README — KO/EN changelog 추가
4. Commit — {커밋 수}개 ({커밋 해시})
5. Push — origin/main
6. Release — {릴리즈 URL}
7. Cache cleanup & rebuild — 완료
```
