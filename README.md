# Claude Synk

> Switch between multiple Claude accounts without losing your work context.

**Problem:** You have multiple Claude Pro accounts. When one runs out of tokens, switching to another loses your entire conversation context — and you have to re-explain everything.

**Solution:** Claude Synk snapshots your work before switching and automatically injects a handoff briefing into your next session, so Claude picks up exactly where you left off.

```
$ claude-synk switch work-account
  [1/4] Saving work snapshot...
  [2/4] Backing up current credentials...
  [3/4] Restoring credentials for "work-account"...
  [4/4] Injecting handoff into CLAUDE.md...

┌──────────────────────────────────────────────┐
│ Account Switched                             │
├──────────────────────────────────────────────┤
│ personal → work-account                      │
│ Your work context has been saved and will be │
│ restored in the next Claude Code session.    │
└──────────────────────────────────────────────┘
```

## How It Works

```
[Account A] ──work──▶ [Token limit] ──snapshot──▶ [Switch] ──restore──▶ [Account B continues]
```

1. **Snapshot** — Captures your current work state (git diff, changed files, work summary, TODOs)
2. **Switch** — Swaps Claude credentials and backs up the previous ones
3. **Handoff** — Injects a structured briefing into `CLAUDE.md` so the next Claude session reads it automatically
4. **Continue** — Start a new Claude Code session. It reads the handoff and continues your work seamlessly

## Installation

```bash
git clone https://github.com/CKtrace/Claude-Synk.git
cd Claude-Synk
npm install
npm run build
npm install -g .
```

## Quick Start

### 1. Register your accounts

Log into your first Claude account normally, then register it:

```bash
claude-synk account add personal
```

Log into your second account (`claude auth login`), then register it:

```bash
claude-synk account add work
```

### 2. Switch when needed

```bash
# Direct switch
claude-synk switch work -m "implementing user auth, login endpoint done"

# Interactive switch (prompts for summary)
claude-synk quick
```

### 3. Start a new Claude Code session

Claude will automatically read the handoff from `CLAUDE.md` and continue your work.

### 4. Clean up when done

```bash
claude-synk clean
```

## Multi-Project Workspace

If you're working on multiple projects at once, register them as workspaces to snapshot and restore all at once.

```bash
# Register workspaces
claude-synk workspace add ~/projects/frontend
claude-synk workspace add ~/projects/backend
claude-synk workspace add ~/projects/mobile

# List registered workspaces
claude-synk workspace list

# Switch account — snapshots ALL workspaces at once
claude-synk switch work --all -m "frontend: auth UI done, backend: API halfway"
```

When you use `--all`, Claude Synk will:
1. Save a snapshot for **every registered workspace**
2. Switch credentials
3. Inject handoffs into **every workspace's CLAUDE.md**

So no matter which project you open next in VSCode, Claude picks up where you left off.

## VSCode Workflow Example

Here's a real-world example of how it works in VSCode:

### Situation
You're building a web app with 2 repos. Token limit hit on Account A.

```
~/projects/frontend/   ← React app, working on login page
~/projects/backend/    ← Express API, adding auth endpoints
```

### Step 1: Register workspaces (one-time)

Open VSCode terminal:

```bash
claude-synk workspace add ~/projects/frontend
claude-synk workspace add ~/projects/backend
```

### Step 2: Token runs out → Switch

```bash
claude-synk switch account-B --all -m "frontend: login form done, need signup. backend: /auth/login done, need /auth/register"
```

### Step 3: Open any project in VSCode → Start new Claude Code session

Claude reads CLAUDE.md automatically and sees:

```markdown
## Previous Session Handoff (by Claude Synk)

**Account:** account-A
**Branch:** feature/auth

### Work Summary
frontend: login form done, need signup. backend: /auth/login done, need /auth/register

### Changed Files
- src/components/LoginForm.tsx
- src/pages/Login.tsx
...
```

### Step 4: Claude continues your work

You just say:

> "Continue where I left off"

Claude already knows what you were doing, which files you changed, and what's next. No re-explaining needed.

### Step 5: Done? Clean up

```bash
claude-synk clean -d ~/projects/frontend
claude-synk clean -d ~/projects/backend
```

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `account add <name>` | | Register a new Claude account |
| `account list` | `account ls` | List all registered accounts |
| `account remove <name>` | `account rm` | Remove an account |
| `account backup <name>` | | Backup current credentials for an account |
| `workspace add <path>` | `ws add` | Register a project workspace |
| `workspace list` | `ws ls` | List all registered workspaces |
| `workspace remove <name>` | `ws rm` | Remove a workspace |
| `switch <account>` | | Switch to another account with auto-snapshot |
| `switch <account> --all` | | Switch and snapshot ALL workspaces |
| `quick` | `q` | Interactive switch with prompts |
| `snapshot` | | Save a work snapshot without switching |
| `restore` | | Inject latest snapshot into CLAUDE.md |
| `history` | | Show snapshot history |
| `status` | | Show current account and project status |
| `clean` | | Remove handoff from CLAUDE.md |

## Options

### `switch`

```bash
claude-synk switch <account> [options]

Options:
  -d, --dir <dir>       Project directory (default: current dir)
  -m, --message <msg>   Summary of current work
  -n, --note <note>     Note for next session
  -a, --all             Snapshot and restore all registered workspaces
  --no-snapshot          Skip saving snapshot
  --no-handoff          Skip injecting handoff
```

### `snapshot`

```bash
claude-synk snapshot [options]

Options:
  -d, --dir <dir>       Project directory (default: current dir)
  -m, --message <msg>   Work summary
  -n, --note <note>     Custom note
  -t, --todo <todos...> Remaining TODOs
```

## Account Types

### OAuth (default)
Uses Claude's built-in OAuth authentication. Claude Synk backs up and restores the credential files in `~/.claude/`.

```bash
claude-synk account add personal          # backs up current login
claude auth login                          # login to another account
claude-synk account add work              # backs up that login
```

### API Key
Stores an encrypted API key locally.

```bash
claude-synk account add work --type apikey --key sk-ant-...
# or interactively (masked input):
claude-synk account add work --type apikey
```

## What Gets Saved in a Snapshot

- Git branch and diff
- List of changed files
- Work summary (your description or auto-generated)
- Remaining TODOs
- Custom notes
- Timestamp and account info

## Security

- API keys are encrypted with AES-256-CBC before storage
- Encryption key is auto-generated per installation
- All config files are created with `0600` permissions (owner-only)
- Credentials are stored in `~/.claude-synk/` with restricted access

## Data Location

```
~/.claude-synk/
├── config.json          # Account registry & settings
├── credentials/         # Backed-up auth files per account
│   ├── personal/
│   └── work/
└── snapshots/           # Work snapshots per project
    └── <project-id>/
        ├── 20260325_abc1.json
        └── 20260325_def2.json
```

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)
