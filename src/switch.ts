import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import {
  loadConfig,
  saveConfig,
  findAccount,
  paths,
  decrypt,
} from './config';
import {
  backupClaudeAuth,
  restoreClaudeAuth,
  injectHandoff,
  removeHandoff,
  printBox,
} from './utils';
import { createSnapshot, buildHandoff, getLatestSnapshot } from './snapshot';

// ─── Switch Account ─────────────────────────────────────────────────

export interface SwitchOptions {
  projectDir: string;
  targetAccount: string;
  summary?: string;
  todos?: string[];
  note?: string;
  skipSnapshot?: boolean;
  skipHandoff?: boolean;
}

export interface SwitchResult {
  success: boolean;
  previousAccount: string | null;
  newAccount: string;
  snapshotId?: string;
  message: string;
}

export function switchAccount(opts: SwitchOptions): SwitchResult {
  const config = loadConfig();
  const target = findAccount(config, opts.targetAccount);

  if (!target) {
    return {
      success: false,
      previousAccount: config.activeAccount,
      newAccount: opts.targetAccount,
      message: `Account "${opts.targetAccount}" not found. Run: claude-synk account add ${opts.targetAccount}`,
    };
  }

  const previousAccount = config.activeAccount;

  // If switching to the same account, skip
  if (previousAccount === opts.targetAccount) {
    return {
      success: true,
      previousAccount,
      newAccount: opts.targetAccount,
      message: `Already using account "${opts.targetAccount}".`,
    };
  }

  // Step 1: Save snapshot of current work
  let snapshotId: string | undefined;
  if (!opts.skipSnapshot) {
    console.log(chalk.blue('\n  [1/4] Saving work snapshot...'));
    const snapshot = createSnapshot({
      projectDir: opts.projectDir,
      summary: opts.summary,
      todos: opts.todos,
      customNote: opts.note,
    });
    snapshotId = snapshot.id;
  }

  // Step 2: Backup current auth
  if (previousAccount) {
    console.log(chalk.blue('  [2/4] Backing up current credentials...'));
    backupClaudeAuth(paths.credentialsBackup, previousAccount);
  } else {
    console.log(chalk.gray('  [2/4] No previous account to backup.'));
  }

  // Step 3: Restore target auth
  console.log(chalk.blue(`  [3/4] Restoring credentials for "${opts.targetAccount}"...`));

  if (target.type === 'oauth') {
    const restored = restoreClaudeAuth(paths.credentialsBackup, opts.targetAccount);
    if (!restored) {
      // First time using this account via oauth — need to login
      return {
        success: false,
        previousAccount,
        newAccount: opts.targetAccount,
        snapshotId,
        message: `No saved credentials for "${opts.targetAccount}". Please run: claude auth login\nThen run: claude-synk account backup ${opts.targetAccount}`,
      };
    }
  } else if (target.type === 'apikey') {
    // Set API key via environment config
    const key = decrypt(target.credential, config.encryptionKey);
    const envFile = path.join(paths.claudeDir, '.env');
    const envContent = `ANTHROPIC_API_KEY=${key}\n`;
    fs.writeFileSync(envFile, envContent, { mode: 0o600 });
  }

  // Step 4: Inject handoff into CLAUDE.md
  if (!opts.skipHandoff) {
    console.log(chalk.blue('  [4/4] Injecting handoff into CLAUDE.md...'));
    const latestSnapshot = getLatestSnapshot(opts.projectDir);
    if (latestSnapshot) {
      const handoffContent = buildHandoff(latestSnapshot);
      injectHandoff(opts.projectDir, handoffContent);
    }
  } else {
    console.log(chalk.gray('  [4/4] Skipping handoff injection.'));
  }

  // Update active account
  config.activeAccount = opts.targetAccount;
  saveConfig(config);

  return {
    success: true,
    previousAccount,
    newAccount: opts.targetAccount,
    snapshotId,
    message: `Switched from "${previousAccount ?? 'none'}" to "${opts.targetAccount}".`,
  };
}

// ─── Display switch result ──────────────────────────────────────────

export function displaySwitchResult(result: SwitchResult): void {
  if (result.success) {
    printBox('Account Switched', [
      `${result.previousAccount ?? 'none'} → ${result.newAccount}`,
      result.snapshotId ? `Snapshot: ${result.snapshotId}` : '',
      '',
      'Your work context has been saved and will be',
      'restored in the next Claude Code session.',
    ].filter(Boolean).join('\n'));
    console.log(chalk.green('\n  Ready! Start a new Claude Code session to continue.\n'));
  } else {
    console.log(chalk.red(`\n  Switch failed: ${result.message}\n`));
  }
}
