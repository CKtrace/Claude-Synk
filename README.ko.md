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
npm install -g claude-synk
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

## 명령어

| 명령어 | 별칭 | 설명 |
|--------|------|------|
| `account add <이름>` | | 새 Claude 계정 등록 |
| `account list` | `account ls` | 등록된 계정 목록 |
| `account remove <이름>` | `account rm` | 계정 제거 |
| `account backup <이름>` | | 현재 인증 정보 백업 |
| `switch <계정>` | | 계정 전환 (자동 스냅샷) |
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
