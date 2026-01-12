import fs from 'fs';
import os from 'os';
import path from 'path';
import type { UsageLimits } from '../types.js';
import { getCredentials } from './credentials.js';

const API_TIMEOUT_MS = 5000;
const CACHE_FILE = path.join(os.tmpdir(), 'claude-ultimate-hud-cache.json');

interface CacheEntry {
  data: UsageLimits;
  timestamp: number;
}

let usageCache: CacheEntry | null = null;

function isCacheValid(ttlSeconds: number): boolean {
  if (!usageCache) return false;
  const ageSeconds = (Date.now() - usageCache.timestamp) / 1000;
  return ageSeconds < ttlSeconds;
}

export async function fetchUsageLimits(ttlSeconds = 60): Promise<UsageLimits | null> {
  if (isCacheValid(ttlSeconds) && usageCache) {
    return usageCache.data;
  }

  const fileCache = loadFileCache(ttlSeconds);
  if (fileCache) {
    usageCache = { data: fileCache, timestamp: Date.now() };
    return fileCache;
  }

  const token = await getCredentials();
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
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();

    const limits: UsageLimits = {
      five_hour: data.five_hour ?? null,
      seven_day: data.seven_day ?? null,
      seven_day_sonnet: data.seven_day_sonnet ?? null,
    };

    usageCache = { data: limits, timestamp: Date.now() };
    saveFileCache(limits);

    return limits;
  } catch {
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
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}
