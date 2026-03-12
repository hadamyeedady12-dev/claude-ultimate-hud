import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type { UsageLimits } from '../types.js';
import { getCredentials } from './credentials.js';
import { debugError, debugTrace } from './errors.js';
import { API_TIMEOUT_MS } from '../constants.js';

const CACHE_DIR = path.join(os.homedir(), '.claude');
const CACHE_FILE = path.join(CACHE_DIR, 'claude-ultimate-hud-cache.json');
const ANTHROPIC_BETA_HEADER = 'oauth-2025-04-20';

export async function fetchUsageLimits(ttlSeconds = 60): Promise<UsageLimits | null> {
  const fileCache = loadFileCache(ttlSeconds);
  if (fileCache) {
    debugTrace('api', 'file cache hit');
    return fileCache;
  }

  debugTrace('api', 'cache expired, fetching');
  let token: string | null = await getCredentials();
  if (!token) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'claude-ultimate-hud/1.0.0',
        Authorization: `Bearer ${token}`,
        'anthropic-beta': ANTHROPIC_BETA_HEADER,
      },
      signal: controller.signal,
    });

    token = null;
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();

    const limits: UsageLimits = {
      five_hour: data.five_hour,
      seven_day: data.seven_day,
      seven_day_sonnet: data.seven_day_sonnet,
    };

    saveFileCache(limits);
    debugTrace('api', 'fetch ok');

    return limits;
  } catch (e) {
    token = null;
    debugError('API fetch', e);
    return null;
  }
}

function loadFileCache(ttlSeconds: number): UsageLimits | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const content = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    const ageSeconds = (Date.now() - content.timestamp) / 1000;
    if (ageSeconds < ttlSeconds) return content.data as UsageLimits;
    return null;
  } catch {
    return null;
  }
}

function saveFileCache(data: UsageLimits): void {
  try {
    // Ensure cache directory exists
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
    }
    // Atomic write: write to temp file then rename to prevent corruption on concurrent read/write
    const tmpFile = CACHE_FILE + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify({ data, timestamp: Date.now() }), { mode: 0o600 });
    fs.renameSync(tmpFile, CACHE_FILE);
  } catch (e) {
    debugError('cache write', e);
  }
}
