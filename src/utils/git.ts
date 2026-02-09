import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { debugError } from './errors.js';
import { EXEC_TIMEOUT_MS } from '../constants.js';

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
    return result.trim() || undefined;
  } catch (e) {
    debugError('git branch', e);
    return undefined;
  }
}
