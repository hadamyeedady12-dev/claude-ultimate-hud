import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { debugError } from './errors.js';
import { BURN_RATE_WINDOW_MS } from '../constants.js';

const SPEED_CACHE_FILE = path.join(os.homedir(), '.claude', 'claude-ultimate-hud-speed-cache.json');

interface SpeedEntry {
  timestamp: number;
  tokens: number;
}

interface SpeedCache {
  entries: SpeedEntry[];
}

/**
 * Record current token count and return burn rate (tokens/min).
 * Returns null if not enough data points.
 */
export function trackTokenSpeed(currentTokens: number): number | null {
  const now = Date.now();

  let entries: SpeedEntry[] = [];
  try {
    if (fs.existsSync(SPEED_CACHE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SPEED_CACHE_FILE, 'utf-8')) as SpeedCache;
      entries = raw.entries ?? [];
    }
  } catch {
    /* ignore */
  }

  entries.push({ timestamp: now, tokens: currentTokens });

  // Prune entries older than window
  entries = entries.filter((e) => now - e.timestamp <= BURN_RATE_WINDOW_MS);

  try {
    fs.writeFileSync(SPEED_CACHE_FILE, JSON.stringify({ entries }), { mode: 0o600 });
  } catch (e) {
    debugError('speed cache write', e);
  }

  if (entries.length < 2) return null;

  const oldest = entries[0];
  const newest = entries[entries.length - 1];
  const timeDiffMs = newest.timestamp - oldest.timestamp;
  if (timeDiffMs < 10_000) return null; // Need at least 10s of data

  const tokenDiff = newest.tokens - oldest.tokens;
  if (tokenDiff <= 0) return null;

  return Math.round((tokenDiff / timeDiffMs) * 60_000);
}
