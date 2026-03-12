const IS_DEBUG = process.env.CLAUDE_HUD_DEBUG === '1';

export function debugError(context: string, error: unknown): void {
  if (!IS_DEBUG) return;
  const msg = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[HUD ERROR] ${context}: ${msg}\n`);
}

export function debugTrace(label: string, msg: string): void {
  if (!IS_DEBUG) return;
  process.stderr.write(`[HUD TRACE] ${label}: ${msg}\n`);
}
