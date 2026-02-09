import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
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

export async function getCredentials(): Promise<string | null> {
  try {
    if (process.platform === 'darwin') {
      return await getCredentialsFromKeychain();
    }
    return await getCredentialsFromFile();
  } catch {
    return null;
  }
}

async function getCredentialsFromKeychain(): Promise<string | null> {
  try {
    const result = await execFileAsync(
      'security',
      ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      { encoding: 'utf-8', timeout: EXEC_TIMEOUT_MS }
    );

    const creds = JSON.parse(result.trim());
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch (e) {
    debugError('keychain read', e);
    return await getCredentialsFromFile();
  }
}

async function getCredentialsFromFile(): Promise<string | null> {
  try {
    const credPath = join(homedir(), '.claude', '.credentials.json');

    // Verify file permissions: reject if group/other have any access
    const fileStat = await stat(credPath);
    if ((fileStat.mode & 0o077) !== 0) {
      process.stderr.write(
        `[claude-ultimate-hud] WARNING: ${credPath} has insecure permissions (${(fileStat.mode & 0o777).toString(8)}). Expected 0600.\n`
      );
    }

    const content = await readFile(credPath, 'utf-8');
    const creds = JSON.parse(content);
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch (e) {
    debugError('credentials file', e);
    return null;
  }
}
