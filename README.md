# claude-ultimate-hud

[English](README.en.md) | [한국어](README.md)

Claude Code를 위한 궁극의 상태 표시줄 플러그인 - [claude-dashboard](https://github.com/uppinote20/claude-dashboard)와 [claude-hud](https://github.com/jarrodwatts/claude-hud)의 장점을 결합했습니다.

![스크린샷](assets/screenshot.png)

## 기능

### claude-dashboard에서 가져온 기능
- 🤖 **모델 표시**: 현재 모델 (Opus, Sonnet, Haiku)
- 📊 **프로그레스 바**: 컨텍스트 사용률 색상 표시 (초록 → 노랑 → 빨강)
- 📈 **토큰 수**: 현재/전체 토큰 (K/M 형식)
- ⏱️ **Rate Limits**: 5시간/7일 제한 및 리셋 카운트다운

### claude-hud에서 가져온 기능
- 📁 **프로젝트 정보**: 디렉토리명 + Git 브랜치
- 📋 **설정 개수**: CLAUDE.md, rules, MCPs, hooks
- ⏱️ **세션 시간**: 작업 시간
- 🔧 **툴 활동**: 실행 중/완료된 툴 및 횟수
- 🤖 **에이전트 상태**: 서브에이전트 진행 상황
- ✅ **TODO 진행률**: 현재 작업 및 완료율

### v1.3.1 - 60배 성능 개선
- 🔥 **clearTimeout 버그 수정**: `readStdin()`의 setTimeout 핸들 미해제로 프로세스가 타이머 만료까지 2~5초 대기하던 핵심 버그 수정
- ⚡ **config-counter 파일 캐시** (60초 TTL): 매 호출 15+ sync FS 호출 → 캐시 hit 시 1회 read
- ⚡ **git branch 파일 캐시** (30초 TTL): 매 호출 child process spawn → 캐시 hit 시 1회 read
- 🔀 **getTranslations 병렬화**: 순차 대기 제거, Phase 2 I/O 블록으로 이동
- 📉 **STDIN 타임아웃 단축**: 5초 → 2초

### v1.3.0 신규 기능
- ⚡ **Transcript 증분 파싱**: 파일 캐시 기반 증분 읽기로 세션이 길어져도 일정한 HUD 속도
- 🚀 **API 캐시 TTL 5배 증가**: 60초 → 300초로 API 블로킹 빈도 대폭 감소
- 🏗️ **pre-built JS 사용**: statusLine이 `dist/index.js`를 직접 실행하여 TS 컴파일 생략
- 🌐 **i18n 확장**: TODO 완료 메시지, Thinking 상태 한국어/영어 번역 지원
- 🐛 **변수 충돌 수정**: `omc-line.ts`의 `t` 변수 shadowing 버그 수정

### 추가 기능
- 🌐 **다국어 지원**: 영어/한국어 자동 감지

## 출력 예시

```
🤖 Opus 4.6 │ ████░░░░░░ 18% │ 37K/200K │ 5시간: 12% (3시간59분) │ 7일: 전체 18% │ 소넷 1%
🔄 ralph:3/10 │ ⚡ ultrawork │ 💭 thinking │ T:42 A:5 S:2
📁 my-project git:(main) │ 2 CLAUDE.md │ 8 rules │ 6 MCPs │ 6 hooks │ ⏱️ 1h30m
◐ Read: file.ts │ ✓ Bash ×5 │ ✓ Edit ×3
◐ explore: 패턴 찾는 중... │ ✓ librarian (2s)
▸ 인증 플로우 구현 (2/5)
⚠️ 컨텍스트 85% - /compact 권장
```

> **참고**: OMC(oh-my-claudecode) 미사용 시 OMC 모드 라인은 표시되지 않습니다. 컨텍스트 경고, thinking 표시, 호출 카운트는 모든 사용자에게 동작합니다.

## 설치

### 플러그인 마켓플레이스에서 설치

```
/plugin marketplace add hadamyeedady12-dev/claude-ultimate-hud
/plugin install claude-ultimate-hud
/claude-ultimate-hud:setup
```

> **참고**: 마켓플레이스 설치 경로는 `~/.claude/plugins/cache/claude-ultimate-hud/`

### 수동 설치

```bash
git clone https://github.com/hadamyeedady12-dev/claude-ultimate-hud.git ~/.claude/plugins/claude-ultimate-hud
cd ~/.claude/plugins/claude-ultimate-hud
bun install && bun run build
```

그 다음 실행:
```
/claude-ultimate-hud:setup
```

## 설정

```
/claude-ultimate-hud:setup
```

실행하면 플랜을 선택하는 인터랙티브 메뉴가 표시됩니다:

| 플랜 | 설명 |
|------|------|
| `max200` | Max $200/월 (20x) - 5시간 + 7일 전체 + 7일 소넷 **(권장)** |
| `max100` | Max $100/월 (5x) - 5시간 + 7일 전체 + 7일 소넷 |
| `pro` | Pro - 5시간만 표시 |

셋업 시 **언어**와 **플랜**을 선택할 수 있습니다. 나중에 변경하려면 `~/.claude/claude-ultimate-hud.local.json` 파일의 `language` 값을 `en`, `ko`, 또는 `auto`로 수정하세요.

## 요구사항

- **Claude Code** v1.0.80+
- **Bun** 또는 **Node.js** 18+

## 색상 범례

| 색상 | 사용률 | 의미 |
|------|--------|------|
| 🟢 초록 | 0-50% | 안전 |
| 🟡 노랑 | 51-80% | 주의 |
| 🔴 빨강 | 81-100% | 위험 |

## 플랜별 차이

| 기능 | pro | max100 | max200 |
|------|-----|--------|--------|
| 5시간 rate limit | ✅ | ✅ | ✅ |
| 리셋 카운트다운 | ✅ | ✅ | ✅ |
| 7일 전체 모델 | ❌ | ✅ | ✅ |
| 7일 Sonnet 전용 | ❌ | ✅ | ✅ |

### Rate Limits 상세

| 플랜 | 5시간 | 주간 Sonnet | 주간 Opus |
|------|-------|-------------|-----------|
| Max $100 (5x) | ~225 메시지 | 140-280시간 | 15-35시간 |
| Max $200 (20x) | ~900 메시지 | 240-480시간 | 24-40시간 |

## 크레딧

이 플러그인은 다음 프로젝트의 기능을 결합했습니다:
- [claude-dashboard](https://github.com/uppinote20/claude-dashboard) by uppinote
- [claude-hud](https://github.com/jarrodwatts/claude-hud) by Jarrod Watts

**별아해** 님의 소중한 피드백과 버그 수정에 감사드립니다.

[OhMyOpenCode](https://github.com/anthropics/claude-code)로 제작되었습니다.

## 변경 이력

### v1.3.1
- 🔥 **60배 성능 개선** (2.0초 → 0.033초)
  - `readStdin()`의 `setTimeout` 핸들이 성공 후에도 해제되지 않아 프로세스가 타이머 만료까지 대기하던 버그 수정
  - `clearTimeout`을 성공/에러 양쪽 경로에 추가
- ⚡ **config-counter 파일 캐시** (60초 TTL)
  - 매 호출 15+ sync FS 호출 제거, 캐시 hit 시 1회 read
- ⚡ **git branch 파일 캐시** (30초 TTL)
  - 매 호출 child process spawn 제거, 캐시 hit 시 1회 read
- 🔀 **getTranslations 병렬화**
  - Phase 1 → Phase 2 병렬 I/O 블록으로 이동
- 📉 **STDIN 타임아웃 단축**: 5초 → 2초

### v1.3.0
- ⚡ **Transcript 증분 파싱**
  - 파일 캐시 기반으로 이전 파싱 위치를 기억하고 새 내용만 읽음
  - 파일 크기 변경 없으면 캐시에서 즉시 반환 (O(1))
  - 세션이 길어져도 일정한 HUD 갱신 속도 유지
- 🚀 **API 캐시 TTL 5배 증가**
  - 기본 캐시 TTL 60초 → 300초
  - Rate limit API 호출로 인한 블로킹 빈도 대폭 감소
- 🏗️ **statusLine 최적화**
  - `src/index.ts` (TS 컴파일 필요) → `dist/index.js` (pre-built) 직접 실행
- 🌐 **i18n 확장**
  - TODO 완료 메시지 번역 (`All todos complete` / `모든 할 일 완료`)
  - Thinking 상태 번역 (`thinking` / `사고 중`)
  - `renderTodosLine`, `renderOmcLine`에 Translations 파라미터 추가
- 🐛 **변수 충돌 수정**
  - `omc-line.ts`에서 `t: Translations` 파라미터와 `const t = ctx.transcript` 변수명 충돌 해결

### v1.2.0
- 📊 **컨텍스트 정확도 개선**
  - `AUTOCOMPACT_BUFFER` 45000 → 0으로 수정하여 실제 토큰 사용량 표시
- ⚠️ **컨텍스트 경고 배너**
  - 80-89%: 노란색 `⚠️ 컨텍스트 85% - /compact 권장`
  - 90%+: 빨간색 `🔴 컨텍스트 95% - /compact 필요!`
  - 한국어/영어 번역 지원
- 🔄 **OMC 모드 상태 표시**
  - ralph (`🔄 ralph:3/10`), autopilot (`🤖 autopilot:Plan(2/5)`), ultrawork (`⚡ ultrawork`)
  - 3단계 fallback: session → state dir → .omc root
  - 2시간 이상 된 stale 파일 자동 무시
  - OMC 미설치 시 완전 no-op (추가 출력 없음)
- 💭 **Thinking 표시**: 모델 사고 중일 때 `💭 thinking` 표시
- 🎯 **스킬 추적**: 마지막 스킬 호출 이름 표시
- 📈 **호출 카운트**: `T:42 A:5 S:2` (도구/에이전트/스킬 누적 횟수)

### v1.1.6
- 🐛 **MCP 서버 카운트 수정**
  - `.claude.json`의 프로젝트 스코프 MCP 서버 감지 (`projects[cwd].mcpServers`)
  - Chrome 확장 MCP (`claude-in-chrome`) 동적 감지
  - Set 기반 중복 제거로 정확한 카운트
- ⚙️ **셋업 개선**
  - 언어 선택 추가: English / Korean / Auto 중 선택 가능

### v1.1.5
- 🔒 **보안 강화**
  - Path Traversal 취약점 수정 (`resolve()` + `sep` 접두사 비교)
  - Keychain/exec 명령에 3초 타임아웃 추가 (무한 블로킹 방지)
  - 자격 증명 파일 권한 검증 (world-readable 시 경고)
- 🐛 **버그 수정**
  - 한국어 `shortHours` 수정: `'시간'` → `'시'` (레이아웃 일관성)
  - Transcript 파서에 런타임 타입 가드 추가 (unsafe cast 제거)
  - 파싱 에러 추적: 50% 이상 실패 시 경고 출력
- ⚡ **성능 개선**
  - 동기 `execFileSync` → 비동기 `execFile` + `Promise.all` 병렬화
  - stdin 읽기 5초 타임아웃 추가
  - 원자적 캐시 파일 쓰기 (임시 파일 + rename)
- 🛠️ **코드 품질**
  - 디버그 모드 추가: `CLAUDE_HUD_DEBUG=1`로 상세 에러 출력
  - 진단용 에러 메시지 (`⚠️ stdin`, `🔑 ?` 등 원인 구분)
  - 13개 매직 넘버를 `constants.ts`에 JSDoc과 함께 통합
  - 스크린샷 최적화: 776KB → 241KB (-69%)

### v1.1.4
- 🐛 **버그 수정**: macOS에서 `LANG=C.UTF-8`일 때 언어 자동 감지 실패 문제 해결
  - `AppleLocale` 설정을 확인하여 시스템 언어 감지

### v1.1.2
- 🔒 **보안 강화**: 경로 검증, 캐시 파일 권한 설정, 재귀 깊이 제한
- 🎨 **UI 개선**: 7일 제한 통합 표시 (`7일: 전체 3% │ 소넷 0%`)
- 🧹 **코드 정리**: 중복 제거, 미사용 함수 삭제
- ❌ **비용 표시 제거**: 상태줄에서 비용($) 표시 삭제
- ⚙️ **설정 개선**: 인터랙티브 플랜 선택, 언어 자동 감지

### v1.0.2
- 초기 릴리즈

## 라이선스

MIT
