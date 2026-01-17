import path from 'node:path';
import type { Translations } from '../types.js';

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toString();
}

export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export function formatTimeRemaining(resetAt: string, t: Translations): string {
  const resetTime = new Date(resetAt).getTime();
  const now = Date.now();
  const diffMs = resetTime - now;

  if (diffMs <= 0) return '0m';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}${t.time.shortHours}${minutes}${t.time.shortMinutes}`;
  }
  return `${minutes}${t.time.shortMinutes}`;
}

export function formatSessionDuration(sessionStart?: Date, now: () => number = () => Date.now()): string {
  if (!sessionStart) return '';

  const ms = now() - sessionStart.getTime();
  const mins = Math.floor(ms / 60000);

  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;

  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h${remainingMins}m`;
}

export function shortenModelName(name: string): string {
  return name.replace(/^Claude\s*/i, '').trim();
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

export function truncatePath(filePath: string, maxLen = 20): string {
  if (filePath.length <= maxLen) return filePath;
  const parts = filePath.split(/[/\\]/);
  const filename = parts.pop() || filePath;
  if (filename.length >= maxLen) return filename.slice(0, maxLen - 3) + '...';
  return '...' + path.sep + filename;
}
