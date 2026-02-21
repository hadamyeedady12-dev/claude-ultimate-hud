import { execFile } from 'node:child_process';
import { existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { debugError } from './errors.js';
import { EXEC_TIMEOUT_MS } from '../constants.js';

const GIT_CACHE_FILE = join(homedir(), '.claude', 'claude-ultimate-hud-git-cache.json');
const GIT_CACHE_TTL_MS = 30_000;

function loadGitCache(cwd: string): string | null {
  try {
    if (!existsSync(GIT_CACHE_FILE)) return null;
    const raw = readFileSync(GIT_CACHE_FILE, 'utf-8');
    const content = JSON.parse(raw) as { cwd: string; timestamp: number; branch: string };
    if (content.cwd !== cwd || Date.now() - content.timestamp > GIT_CACHE_TTL_MS) return null;
    return content.branch;
  } catch {
    return null;
  }
}

function saveGitCache(cwd: string, branch: string): void {
  try {
    writeFileSync(GIT_CACHE_FILE, JSON.stringify({ cwd, timestamp: Date.now(), branch }), { mode: 0o600 });
  } catch { /* ignore */ }
}

function execFileAsync(cmd: string, args: string[], options: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (error, stdout) => {
      if (error) reject(error);
      else resolve(String(stdout));
    });
  });
}

export async function getGitBranch(cwd?: string): Promise<string | undefined> {
  if (!cwd) return undefined;

  const cached = loadGitCache(cwd);
  if (cached) return cached;

  // Validate cwd exists and is a directory
  try {
    if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  try {
    const result = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf-8',
      timeout: EXEC_TIMEOUT_MS,
    });
    const branch = result.trim() || undefined;
    if (branch) saveGitCache(cwd, branch);
    return branch;
  } catch (e) {
    debugError('git branch', e);
    return undefined;
  }
}
