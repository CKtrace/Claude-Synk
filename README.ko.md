# Claude Synk

> 여러 Claude 계정을 전환해도 작업 컨텍스트를 잃지 않습니다.

**문제:** Claude Pro 계정이 여러 개 있는데, 토큰이 다 되면 다른 계정으로 전환해야 합니다. 그런데 전환하면 대화 맥락이 날아가서 처음부터 다시 설명해야 합니다.

**해결:** Claude Synk는 계정 전환 전에 작업 상태를 스냅샷으로 저장하고, 다음 세션에 자동으로 핸드오프 브리핑을 주입합니다. Claude가 이전 작업을 이어서 진행합니다.

```
$ claude-synk switch work-account
  [1/4] 작업 스냅샷 저장 중...
  [2/4] 현재 인증 정보 백업 중...
  [3/4] "work-account" 인증 정보 복원 중...
  [4/4] CLAUDE.md에 핸드오프 주입 중...

┌──────────────────────────────────────────────┐
│ 계정 전환 완료                                │
├──────────────────────────────────────────────┤
│ personal → work-account                      │
│ 작업 컨텍스트가 저장되었으며                    │
│ 다음 Claude Code 세션에서 복원됩니다.          │
└──────────────────────────────────────────────┘
```

## 동작 원리

```
[계정 A 작업] ──▶ [토큰 소진] ──스냅샷──▶ [전환] ──복원──▶ [계정 B가 이어서 작업]
```

1. **스냅샷** — 현재 작업 상태를 캡처합니다 (git diff, 변경 파일, 작업 요약, TODO)
2. **전환** — Claude 인증 정보를 교체하고 이전 것을 백업합니다
3. **핸드오프** — `CLAUDE.md`에 구조화된 브리핑을 주입합니다
4. **계속** — 새 Claude Code 세션을 시작하면 핸드오프를 읽고 작업을 이어갑니다

## 설치

```bash
git clone https://github.com/CKtrace/Claude-Synk.git
cd Claude-Synk
npm install
npm run build
npm install -g .
```

## 빠른 시작

### 1. 계정 등록

첫 번째 Claude 계정으로 로그인한 상태에서:

```bash
claude-synk account add personal
```

두 번째 계정으로 로그인 (`claude auth login`) 후:

```bash
claude-synk account add work
```

### 2. 필요할 때 전환

```bash
# 직접 전환
claude-synk switch work -m "유저 인증 구현 중, 로그인 엔드포인트 완료"

# 대화형 전환 (요약 입력 프롬프트)
claude-synk quick
```

### 3. 새 Claude Code 세션 시작

Claude가 `CLAUDE.md`의 핸드오프를 자동으로 읽고 작업을 이어갑니다.

### 4. 정리

```bash
claude-synk clean
```

## 멀티 프로젝트 워크스페이스

여러 프로젝트를 동시에 작업 중이라면, 워크스페이스로 등록해서 한번에 스냅샷/복원할 수 있습니다.

```bash
# 워크스페이스 등록
claude-synk workspace add ~/projects/frontend
claude-synk workspace add ~/projects/backend

# 등록된 워크스페이스 확인
claude-synk workspace list

# 계정 전환 — 모든 워크스페이스 한번에 스냅샷
claude-synk switch work --all -m "frontend: 로그인 UI 완료, backend: API 절반"
```

`--all` 옵션 사용 시:
1. **등록된 모든 워크스페이스**의 스냅샷 저장
2. 인증 정보 교체
3. **모든 워크스페이스의 CLAUDE.md**에 핸드오프 주입

어떤 프로젝트를 열든 Claude가 이전 작업을 이어갑니다.

## VSCode 사용 예시

### 상황
웹앱을 2개 레포로 개발 중. 계정 A의 토큰이 다 됨.

```
~/projects/frontend/   ← React 앱, 로그인 페이지 작업 중
~/projects/backend/    ← Express API, 인증 엔드포인트 추가 중
```

### Step 1: 워크스페이스 등록 (최초 1회)

VSCode 터미널에서:

```bash
claude-synk workspace add ~/projects/frontend
claude-synk workspace add ~/projects/backend
```

### Step 2: 토큰 소진 → 전환

```bash
claude-synk switch 계정B --all -m "frontend: 로그인 폼 완성, 회원가입 필요. backend: /auth/login 완료, /auth/register 필요"
```

### Step 3: VSCode에서 프로젝트 열기 → 새 Claude Code 세션 시작

Claude가 CLAUDE.md를 자동으로 읽고 이런 내용을 봅니다:

```markdown
## Previous Session Handoff (by Claude Synk)

**Account:** 계정A
**Branch:** feature/auth

### Work Summary
frontend: 로그인 폼 완성, 회원가입 필요. backend: /auth/login 완료, /auth/register 필요

### Changed Files
- src/components/LoginForm.tsx
- src/pages/Login.tsx
...
```

### Step 4: Claude에게 말하기

> "이전 작업 이어서 해줘"

Claude가 이미 무엇을 하고 있었는지, 어떤 파일을 수정했는지, 다음에 뭘 해야 하는지 알고 있습니다. 처음부터 다시 설명할 필요 없음.

### Step 5: 작업 완료 후 정리

```bash
claude-synk clean -d ~/projects/frontend
claude-synk clean -d ~/projects/backend
```

## 명령어

| 명령어 | 별칭 | 설명 |
|--------|------|------|
| `account add <이름>` | | 새 Claude 계정 등록 |
| `account list` | `account ls` | 등록된 계정 목록 |
| `account remove <이름>` | `account rm` | 계정 제거 |
| `account backup <이름>` | | 현재 인증 정보 백업 |
| `workspace add <경로>` | `ws add` | 프로젝트 워크스페이스 등록 |
| `workspace list` | `ws ls` | 등록된 워크스페이스 목록 |
| `workspace remove <이름>` | `ws rm` | 워크스페이스 제거 |
| `switch <계정>` | | 계정 전환 (자동 스냅샷) |
| `switch <계정> --all` | | 전환 + 모든 워크스페이스 스냅샷 |
| `quick` | `q` | 대화형 전환 |
| `snapshot` | | 전환 없이 스냅샷만 저장 |
| `restore` | | 최신 스냅샷을 CLAUDE.md에 주입 |
| `history` | | 스냅샷 히스토리 |
| `status` | | 현재 상태 확인 |
| `clean` | | CLAUDE.md에서 핸드오프 제거 |

## 계정 타입

### OAuth (기본)
Claude의 OAuth 인증을 사용합니다. `~/.claude/`의 인증 파일을 백업/복원합니다.

```bash
claude-synk account add personal          # 현재 로그인 백업
claude auth login                          # 다른 계정으로 로그인
claude-synk account add work              # 해당 로그인 백업
```

### API Key
암호화된 API 키를 로컬에 저장합니다.

```bash
claude-synk account add work --type apikey --key sk-ant-...
```

## 보안

- API 키는 AES-256-CBC로 암호화하여 저장
- 암호화 키는 설치 시 자동 생성
- 모든 설정 파일은 `0600` 권한 (소유자만 접근 가능)

## 라이선스

[MIT](LICENSE)
