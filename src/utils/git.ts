import { existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { GitInfo } from '../types.js';
import { debugError } from './errors.js';
import { execFileAsync } from './exec.js';
import { EXEC_TIMEOUT_MS } from '../constants.js';

const GIT_CACHE_FILE = join(homedir(), '.claude', 'claude-ultimate-hud-git-cache.json');
const GIT_CACHE_TTL_MS = 120_000;

interface GitCache {
  cwd: string;
  timestamp: number;
  info: GitInfo;
}

function loadGitCache(cwd: string): GitInfo | null {
  try {
    if (!existsSync(GIT_CACHE_FILE)) return null;
    const raw = readFileSync(GIT_CACHE_FILE, 'utf-8');
    const content = JSON.parse(raw) as GitCache;
    if (content.cwd !== cwd || Date.now() - content.timestamp > GIT_CACHE_TTL_MS) return null;
    return content.info;
  } catch {
    return null;
  }
}

function saveGitCache(cwd: string, info: GitInfo): void {
  try {
    writeFileSync(GIT_CACHE_FILE, JSON.stringify({ cwd, timestamp: Date.now(), info }), { mode: 0o600 });
  } catch {
    /* ignore */
  }
}

export async function getGitInfo(cwd?: string): Promise<GitInfo | undefined> {
  if (!cwd) return undefined;

  const cached = loadGitCache(cwd);
  if (cached) return cached;

  try {
    if (!existsSync(cwd) || !statSync(cwd).isDirectory()) return undefined;
  } catch {
    return undefined;
  }

  try {
    const execOpts = { cwd, encoding: 'utf-8', timeout: EXEC_TIMEOUT_MS };

    // Run all 3 git commands in parallel
    const [branchResult, statusResult, upstreamResult] = await Promise.all([
      execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], execOpts),
      execFileAsync('git', ['--no-optional-locks', 'status', '--porcelain'], execOpts).catch(() => ''),
      execFileAsync('git', ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'], execOpts).catch(() => ''),
    ]);

    const branch = branchResult.trim();
    if (!branch) return undefined;

    const dirty = statusResult.trim().length > 0;

    let ahead = 0;
    let behind = 0;
    const parts = upstreamResult.trim().split(/\s+/);
    if (parts.length === 2) {
      behind = parseInt(parts[0], 10) || 0;
      ahead = parseInt(parts[1], 10) || 0;
    }

    const info: GitInfo = { branch, dirty, ahead, behind };
    saveGitCache(cwd, info);
    return info;
  } catch (e) {
    debugError('git info', e);
    return undefined;
  }
}
