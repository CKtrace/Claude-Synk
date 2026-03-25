import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────

export interface Account {
  name: string;
  type: 'oauth' | 'apikey';
  /** For oauth: path to the credential file to copy. For apikey: encrypted key. */
  credential: string;
  addedAt: string;
}

export interface Workspace {
  name: string;
  path: string;
  addedAt: string;
}

export interface SynkConfig {
  activeAccount: string | null;
  accounts: Account[];
  workspaces: Workspace[];
  encryptionKey: string;
}

export interface Snapshot {
  id: string;
  account: string;
  project: string;
  timestamp: string;
  summary: string;
  gitBranch: string;
  gitDiff: string;
  changedFiles: string[];
  todos: string[];
  customNote: string;
}

// ─── Paths ───────────────────────────────────────────────────────────

const SYNK_DIR = path.join(os.homedir(), '.claude-synk');
const CONFIG_FILE = path.join(SYNK_DIR, 'config.json');
const SNAPSHOTS_DIR = path.join(SYNK_DIR, 'snapshots');
const CLAUDE_DIR = path.join(os.homedir(), '.claude');

export const paths = {
  synkDir: SYNK_DIR,
  configFile: CONFIG_FILE,
  snapshotsDir: SNAPSHOTS_DIR,
  claudeDir: CLAUDE_DIR,
  credentialsBackup: path.join(SYNK_DIR, 'credentials'),
};

// ─── Config Management ──────────────────────────────────────────────

function ensureDirs(): void {
  for (const dir of [SYNK_DIR, SNAPSHOTS_DIR, paths.credentialsBackup]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }
}

function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function loadConfig(): SynkConfig {
  ensureDirs();
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig: SynkConfig = {
      activeAccount: null,
      accounts: [],
      workspaces: [],
      encryptionKey: generateEncryptionKey(),
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), { mode: 0o600 });
    return defaultConfig;
  }
  const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const config = JSON.parse(raw) as SynkConfig;
  // Migrate: add workspaces if missing (from older config)
  if (!config.workspaces) {
    config.workspaces = [];
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  }
  return config;
}

export function saveConfig(config: SynkConfig): void {
  ensureDirs();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

// ─── Encryption helpers ─────────────────────────────────────────────

export function encrypt(text: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string, key: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  if (!ivHex || !encrypted) throw new Error('Invalid encrypted text format');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ─── Account helpers ────────────────────────────────────────────────

export function findAccount(config: SynkConfig, name: string): Account | undefined {
  return config.accounts.find(a => a.name === name);
}

export function getActiveAccount(config: SynkConfig): Account | null {
  if (!config.activeAccount) return null;
  return findAccount(config, config.activeAccount) ?? null;
}

// ─── Snapshot helpers ───────────────────────────────────────────────

function snapshotPath(projectId: string, snapshotId: string): string {
  const dir = path.join(SNAPSHOTS_DIR, projectId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `${snapshotId}.json`);
}

export function saveSnapshot(snapshot: Snapshot): string {
  const projectId = snapshot.project.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = snapshotPath(projectId, snapshot.id);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  return filePath;
}

export function loadLatestSnapshot(projectDir: string): Snapshot | null {
  const projectId = projectDir.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(SNAPSHOTS_DIR, projectId);
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const raw = fs.readFileSync(path.join(dir, files[0]!), 'utf-8');
  return JSON.parse(raw) as Snapshot;
}

export function listSnapshots(projectDir: string): Snapshot[] {
  const projectId = projectDir.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(SNAPSHOTS_DIR, projectId);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .map(f => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
      return JSON.parse(raw) as Snapshot;
    });
}
