#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import * as path from 'path';
import {
  loadConfig,
  saveConfig,
  findAccount,
  getActiveAccount,
  encrypt,
  Account,
  Workspace,
  paths,
} from './config';
import {
  printBox,
  formatTimestamp,
  isGitRepo,
  getGitBranch,
  getChangedFiles,
  backupClaudeAuth,
  removeHandoff,
} from './utils';
import {
  createSnapshot,
  showSnapshots,
  getLatestSnapshot,
  displaySnapshot,
  buildHandoff,
} from './snapshot';
import { switchAccount, displaySwitchResult } from './switch';

const program = new Command();

program
  .name('claude-synk')
  .description('Switch between multiple Claude accounts without losing work context')
  .version('1.0.0');

// ─── account add ────────────────────────────────────────────────────

program
  .command('account')
  .description('Manage Claude accounts')
  .addCommand(
    new Command('add')
      .description('Add a new Claude account')
      .argument('<name>', 'Account name (e.g., personal, work)')
      .option('-t, --type <type>', 'Account type: oauth or apikey', 'oauth')
      .option('-k, --key <key>', 'API key (for apikey type)')
      .action(async (name: string, opts: { type: string; key?: string }) => {
        const config = loadConfig();

        if (findAccount(config, name)) {
          console.log(chalk.red(`\n  Account "${name}" already exists.\n`));
          process.exit(1);
        }

        const type = opts.type as 'oauth' | 'apikey';
        let credential = '';

        if (type === 'apikey') {
          let key = opts.key;
          if (!key) {
            const answers = await inquirer.prompt([
              {
                type: 'password',
                name: 'apiKey',
                message: 'Enter your Anthropic API key:',
                mask: '*',
              },
            ]);
            key = answers.apiKey;
          }
          credential = encrypt(key!, config.encryptionKey);
        } else {
          // OAuth: backup current claude credentials for this account
          console.log(chalk.blue(`\n  Backing up current Claude credentials as "${name}"...`));
          backupClaudeAuth(paths.credentialsBackup, name);
          credential = 'oauth-backed-up';
        }

        const account: Account = {
          name,
          type,
          credential,
          addedAt: new Date().toISOString(),
        };

        config.accounts.push(account);

        // If first account, set as active
        if (!config.activeAccount) {
          config.activeAccount = name;
        }

        saveConfig(config);
        console.log(chalk.green(`\n  Account "${name}" added successfully!`));

        if (config.activeAccount === name) {
          console.log(chalk.gray(`  Set as active account.\n`));
        } else {
          console.log(chalk.gray(`  Switch to it with: claude-synk switch ${name}\n`));
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List all accounts')
      .alias('ls')
      .action(() => {
        const config = loadConfig();
        if (config.accounts.length === 0) {
          console.log(chalk.yellow('\n  No accounts configured.'));
          console.log(chalk.gray('  Add one with: claude-synk account add <name>\n'));
          return;
        }

        console.log(chalk.bold('\n  Claude Accounts\n'));
        for (const acc of config.accounts) {
          const active = acc.name === config.activeAccount ? chalk.green(' ● ') : '   ';
          const type = chalk.gray(`[${acc.type}]`);
          const date = chalk.gray(formatTimestamp(acc.addedAt));
          console.log(`  ${active}${chalk.white(acc.name)} ${type} ${date}`);
        }
        console.log();
      })
  )
  .addCommand(
    new Command('remove')
      .description('Remove an account')
      .alias('rm')
      .argument('<name>', 'Account name to remove')
      .action(async (name: string) => {
        const config = loadConfig();
        const idx = config.accounts.findIndex(a => a.name === name);

        if (idx === -1) {
          console.log(chalk.red(`\n  Account "${name}" not found.\n`));
          process.exit(1);
        }

        const answers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Remove account "${name}"?`,
            default: false,
          },
        ]);

        if (!answers.confirm) {
          console.log(chalk.gray('\n  Cancelled.\n'));
          return;
        }

        config.accounts.splice(idx, 1);
        if (config.activeAccount === name) {
          config.activeAccount = config.accounts.length > 0 ? config.accounts[0]!.name : null;
        }

        saveConfig(config);
        console.log(chalk.green(`\n  Account "${name}" removed.\n`));
      })
  )
  .addCommand(
    new Command('backup')
      .description('Backup current Claude credentials for an account')
      .argument('<name>', 'Account name')
      .action((name: string) => {
        const config = loadConfig();
        if (!findAccount(config, name)) {
          console.log(chalk.red(`\n  Account "${name}" not found.\n`));
          process.exit(1);
        }
        backupClaudeAuth(paths.credentialsBackup, name);
        console.log(chalk.green(`\n  Credentials backed up for "${name}".\n`));
      })
  );

// ─── workspace ──────────────────────────────────────────────────────

program
  .command('workspace')
  .alias('ws')
  .description('Manage project workspaces for multi-project switching')
  .addCommand(
    new Command('add')
      .description('Register a project workspace')
      .argument('<path>', 'Project directory path')
      .option('-n, --name <name>', 'Workspace name (default: folder name)')
      .action((wsPath: string, opts: { name?: string }) => {
        const config = loadConfig();
        const fs = require('fs');
        const resolvedPath = path.resolve(wsPath);
        const name = opts.name ?? path.basename(resolvedPath);

        if (!fs.existsSync(resolvedPath)) {
          console.log(chalk.red(`\n  Path does not exist: ${resolvedPath}`));
          console.log(chalk.gray(`  Please check the path and try again.\n`));
          process.exit(1);
        }

        if (config.workspaces.find(w => w.path === resolvedPath)) {
          console.log(chalk.red(`\n  Workspace "${resolvedPath}" already registered.\n`));
          process.exit(1);
        }

        const workspace: Workspace = {
          name,
          path: resolvedPath,
          addedAt: new Date().toISOString(),
        };

        config.workspaces.push(workspace);
        saveConfig(config);
        console.log(chalk.green(`\n  Workspace "${name}" added (${resolvedPath})\n`));
      })
  )
  .addCommand(
    new Command('list')
      .description('List all registered workspaces')
      .alias('ls')
      .action(() => {
        const config = loadConfig();
        if (config.workspaces.length === 0) {
          console.log(chalk.yellow('\n  No workspaces registered.'));
          console.log(chalk.gray('  Add one with: claude-synk workspace add <path>\n'));
          return;
        }

        console.log(chalk.bold('\n  Registered Workspaces\n'));
        for (const ws of config.workspaces) {
          const branch = isGitRepo(ws.path) ? chalk.cyan(` [${getGitBranch(ws.path)}]`) : '';
          console.log(`    ${chalk.white(ws.name)}${branch}`);
          console.log(chalk.gray(`      ${ws.path}\n`));
        }
      })
  )
  .addCommand(
    new Command('remove')
      .description('Remove a workspace')
      .alias('rm')
      .argument('<name>', 'Workspace name to remove')
      .action((name: string) => {
        const config = loadConfig();
        const idx = config.workspaces.findIndex(w => w.name === name);
        if (idx === -1) {
          console.log(chalk.red(`\n  Workspace "${name}" not found.\n`));
          process.exit(1);
        }
        config.workspaces.splice(idx, 1);
        saveConfig(config);
        console.log(chalk.green(`\n  Workspace "${name}" removed.\n`));
      })
  );

// ─── switch ─────────────────────────────────────────────────────────

program
  .command('switch')
  .description('Switch to another Claude account (saves context automatically)')
  .argument('<account>', 'Target account name')
  .option('-d, --dir <dir>', 'Project directory', process.cwd())
  .option('-m, --message <msg>', 'Summary of current work')
  .option('-n, --note <note>', 'Custom note for handoff')
  .option('-a, --all', 'Snapshot and restore all registered workspaces')
  .option('--no-snapshot', 'Skip saving snapshot')
  .option('--no-handoff', 'Skip injecting handoff into CLAUDE.md')
  .action((account: string, opts: {
    dir: string;
    message?: string;
    note?: string;
    all?: boolean;
    snapshot: boolean;
    handoff: boolean;
  }) => {
    console.log(chalk.bold('\n  Claude Synk — Switching Account\n'));

    const result = switchAccount({
      projectDir: opts.dir,
      targetAccount: account,
      summary: opts.message,
      note: opts.note,
      all: opts.all,
      skipSnapshot: !opts.snapshot,
      skipHandoff: !opts.handoff,
    });

    displaySwitchResult(result);
  });

// ─── snapshot ───────────────────────────────────────────────────────

program
  .command('snapshot')
  .description('Save a snapshot of current work context')
  .option('-d, --dir <dir>', 'Project directory', process.cwd())
  .option('-m, --message <msg>', 'Work summary')
  .option('-n, --note <note>', 'Custom note')
  .option('-t, --todo <todos...>', 'Remaining TODOs')
  .action((opts: { dir: string; message?: string; note?: string; todo?: string[] }) => {
    console.log(chalk.bold('\n  Claude Synk — Saving Snapshot\n'));
    const snapshot = createSnapshot({
      projectDir: opts.dir,
      summary: opts.message,
      todos: opts.todo,
      customNote: opts.note,
    });
    displaySnapshot(snapshot);
  });

// ─── restore ────────────────────────────────────────────────────────

program
  .command('restore')
  .description('Restore last snapshot into CLAUDE.md handoff')
  .option('-d, --dir <dir>', 'Project directory', process.cwd())
  .action((opts: { dir: string }) => {
    const snapshot = getLatestSnapshot(opts.dir);
    if (!snapshot) {
      console.log(chalk.yellow('\n  No snapshots found for this project.\n'));
      process.exit(1);
    }

    const handoff = buildHandoff(snapshot);
    const { injectHandoff } = require('./utils');
    injectHandoff(opts.dir, handoff);

    console.log(chalk.green('\n  Handoff injected into CLAUDE.md'));
    console.log(chalk.gray(`  From snapshot: ${snapshot.id}\n`));
  });

// ─── clean ──────────────────────────────────────────────────────────

program
  .command('clean')
  .description('Remove handoff section from CLAUDE.md')
  .option('-d, --dir <dir>', 'Project directory', process.cwd())
  .action((opts: { dir: string }) => {
    removeHandoff(opts.dir);
    console.log(chalk.green('\n  Handoff section removed from CLAUDE.md.\n'));
  });

// ─── history ────────────────────────────────────────────────────────

program
  .command('history')
  .description('Show snapshot history for current project')
  .option('-d, --dir <dir>', 'Project directory', process.cwd())
  .action((opts: { dir: string }) => {
    showSnapshots(opts.dir);
  });

// ─── status ─────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show current account and project status')
  .option('-d, --dir <dir>', 'Project directory', process.cwd())
  .action((opts: { dir: string }) => {
    const config = loadConfig();
    const active = getActiveAccount(config);
    const dir = opts.dir;

    const lines: string[] = [];
    lines.push(`Active Account: ${active ? chalk.green(active.name) : chalk.yellow('none')}`);
    lines.push(`Accounts:       ${config.accounts.length}`);

    if (isGitRepo(dir)) {
      lines.push(`Git Branch:     ${getGitBranch(dir)}`);
      lines.push(`Changed Files:  ${getChangedFiles(dir).length}`);
    }

    const latest = getLatestSnapshot(dir);
    if (latest) {
      lines.push(`Last Snapshot:  ${latest.id} (${formatTimestamp(latest.timestamp)})`);
    } else {
      lines.push(`Last Snapshot:  none`);
    }

    printBox('Claude Synk Status', lines.join('\n'));
    console.log();
  });

// ─── Quick switch (interactive) ─────────────────────────────────────

program
  .command('quick')
  .alias('q')
  .description('Interactive quick switch with prompts')
  .option('-d, --dir <dir>', 'Project directory', process.cwd())
  .action(async (opts: { dir: string }) => {
    const config = loadConfig();

    if (config.accounts.length < 2) {
      console.log(chalk.yellow('\n  Need at least 2 accounts to switch.'));
      console.log(chalk.gray('  Add accounts with: claude-synk account add <name>\n'));
      return;
    }

    const otherAccounts = config.accounts.filter(a => a.name !== config.activeAccount);

    console.log(chalk.bold('\n  Claude Synk — Quick Switch\n'));
    console.log(chalk.gray(`  Current: ${config.activeAccount ?? 'none'}\n`));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'target',
        message: 'Switch to:',
        choices: otherAccounts.map(a => ({
          name: `${a.name} [${a.type}]`,
          value: a.name,
        })),
      },
      {
        type: 'input',
        name: 'summary',
        message: 'Brief summary of current work (optional):',
      },
      {
        type: 'input',
        name: 'note',
        message: 'Note for next session (optional):',
      },
    ]);

    const result = switchAccount({
      projectDir: opts.dir,
      targetAccount: answers.target,
      summary: answers.summary || undefined,
      note: answers.note || undefined,
    });

    displaySwitchResult(result);
  });

// ─── Parse & Run ────────────────────────────────────────────────────

program.parse();
