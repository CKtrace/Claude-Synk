import * as path from 'path';
import chalk from 'chalk';
import {
  loadConfig,
  saveSnapshot,
  loadLatestSnapshot,
  listSnapshots,
  Snapshot,
} from './config';
import {
  isGitRepo,
  getGitBranch,
  getGitDiffFull,
  getChangedFiles,
  getGitLog,
  generateId,
  formatTimestamp,
  printBox,
} from './utils';

// ─── Create Snapshot ────────────────────────────────────────────────

export interface SnapshotOptions {
  projectDir: string;
  summary?: string;
  todos?: string[];
  customNote?: string;
}

export function createSnapshot(opts: SnapshotOptions): Snapshot {
  const config = loadConfig();
  const accountName = config.activeAccount ?? 'unknown';
  const dir = path.resolve(opts.projectDir);

  let gitBranch = '';
  let gitDiff = '';
  let changedFiles: string[] = [];

  if (isGitRepo(dir)) {
    gitBranch = getGitBranch(dir);
    gitDiff = getGitDiffFull(dir);
    changedFiles = getChangedFiles(dir);
  }

  const snapshot: Snapshot = {
    id: generateId(),
    account: accountName,
    project: dir,
    timestamp: new Date().toISOString(),
    summary: opts.summary ?? buildAutoSummary(dir, changedFiles),
    gitBranch,
    gitDiff,
    changedFiles,
    todos: opts.todos ?? [],
    customNote: opts.customNote ?? '',
  };

  const filePath = saveSnapshot(snapshot);
  console.log(chalk.green(`\n  Snapshot saved: ${snapshot.id}`));
  console.log(chalk.gray(`  File: ${filePath}\n`));

  return snapshot;
}

function buildAutoSummary(dir: string, changedFiles: string[]): string {
  const parts: string[] = [];
  const branch = getGitBranch(dir);
  const recentLog = getGitLog(dir, 3);

  if (branch) parts.push(`Branch: ${branch}`);
  if (changedFiles.length > 0) {
    parts.push(`Changed files (${changedFiles.length}):`);
    for (const f of changedFiles.slice(0, 20)) {
      parts.push(`  ${f}`);
    }
    if (changedFiles.length > 20) {
      parts.push(`  ... and ${changedFiles.length - 20} more`);
    }
  }
  if (recentLog) {
    parts.push(`\nRecent commits:\n${recentLog}`);
  }

  return parts.join('\n');
}

// ─── Build Handoff Document ─────────────────────────────────────────

export function buildHandoff(snapshot: Snapshot): string {
  const lines: string[] = [];

  lines.push(`**Account:** ${snapshot.account}`);
  lines.push(`**Time:** ${formatTimestamp(snapshot.timestamp)}`);
  lines.push(`**Branch:** ${snapshot.gitBranch || 'N/A'}`);
  lines.push('');

  if (snapshot.summary) {
    lines.push('### Work Summary');
    lines.push(snapshot.summary);
    lines.push('');
  }

  if (snapshot.changedFiles.length > 0) {
    lines.push('### Changed Files');
    for (const f of snapshot.changedFiles) {
      lines.push(`- ${f}`);
    }
    lines.push('');
  }

  if (snapshot.todos.length > 0) {
    lines.push('### Remaining TODOs');
    for (const t of snapshot.todos) {
      lines.push(`- [ ] ${t}`);
    }
    lines.push('');
  }

  if (snapshot.customNote) {
    lines.push('### Notes');
    lines.push(snapshot.customNote);
    lines.push('');
  }

  if (snapshot.gitDiff) {
    lines.push('<details>');
    lines.push('<summary>Git Diff (click to expand)</summary>');
    lines.push('');
    lines.push('```diff');
    // Limit diff size for handoff
    const maxDiffLines = 200;
    const diffLines = snapshot.gitDiff.split('\n');
    if (diffLines.length > maxDiffLines) {
      lines.push(diffLines.slice(0, maxDiffLines).join('\n'));
      lines.push(`\n... (${diffLines.length - maxDiffLines} more lines truncated)`);
    } else {
      lines.push(snapshot.gitDiff);
    }
    lines.push('```');
    lines.push('</details>');
  }

  return lines.join('\n');
}

// ─── Display Snapshot ───────────────────────────────────────────────

export function displaySnapshot(snapshot: Snapshot): void {
  const content = [
    `Account:  ${snapshot.account}`,
    `Time:     ${formatTimestamp(snapshot.timestamp)}`,
    `Branch:   ${snapshot.gitBranch || 'N/A'}`,
    `Files:    ${snapshot.changedFiles.length} changed`,
    `TODOs:    ${snapshot.todos.length}`,
  ].join('\n');

  printBox(`Snapshot ${snapshot.id}`, content);

  if (snapshot.summary) {
    console.log(chalk.gray('\n  Summary:'));
    for (const line of snapshot.summary.split('\n')) {
      console.log(chalk.gray(`    ${line}`));
    }
  }

  if (snapshot.customNote) {
    console.log(chalk.yellow('\n  Note: ') + snapshot.customNote);
  }
  console.log();
}

// ─── List & Get ─────────────────────────────────────────────────────

export function showSnapshots(projectDir: string): void {
  const dir = path.resolve(projectDir);
  const snapshots = listSnapshots(dir);

  if (snapshots.length === 0) {
    console.log(chalk.yellow('\n  No snapshots found for this project.\n'));
    return;
  }

  console.log(chalk.bold(`\n  Snapshots for: ${dir}\n`));
  for (const s of snapshots) {
    console.log(
      chalk.cyan(`  ${s.id}`) +
      chalk.gray(` | ${s.account} | ${formatTimestamp(s.timestamp)} | `) +
      chalk.white(`${s.changedFiles.length} files`)
    );
  }
  console.log();
}

export function getLatestSnapshot(projectDir: string): Snapshot | null {
  return loadLatestSnapshot(path.resolve(projectDir));
}
