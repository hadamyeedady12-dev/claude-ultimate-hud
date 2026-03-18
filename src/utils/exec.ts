import { execFile, type ExecFileOptions } from 'node:child_process';

export function execFileAsync(cmd: string, args: string[], options?: ExecFileOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options ?? {}, (error, stdout) => {
      if (error) reject(error);
      else resolve(String(stdout));
    });
  });
}
