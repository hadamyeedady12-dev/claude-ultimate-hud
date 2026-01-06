import { execFileSync } from 'child_process';

export async function getGitBranch(cwd?: string): Promise<string | undefined> {
  if (!cwd) return undefined;
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
