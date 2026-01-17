import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

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
    const result = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return result || undefined;
  } catch {
    return undefined;
  }
}
