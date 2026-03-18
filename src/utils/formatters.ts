import path from 'node:path';
import type { Translations } from '../types.js';

export function formatTokens(n: number): string {
  if (n >= 950_000) return `${(n / 1_000_000).toFixed(1)}M`;
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
  return formatDurationMs(ms);
}

export function formatSessionDurationMs(ms: number): string {
  return formatDurationMs(ms);
}

function formatDurationMs(ms: number): string {
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

// --- ANSI / visual width utilities ---

const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '');
}

function isWideChar(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0x303e) || // CJK Radicals/Symbols
    (code >= 0x3040 && code <= 0x9fff) || // CJK, Hiragana, Katakana
    (code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility
    (code >= 0xfe10 && code <= 0xfe6f) || // CJK Forms
    (code >= 0xff01 && code <= 0xff60) || // Fullwidth
    (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth Signs
    (code >= 0x20000 && code <= 0x2fa1f) || // CJK Extension B+
    (code >= 0x1f300 && code <= 0x1f9ff) // Emoji
  );
}

export function visualWidth(str: string): number {
  const plain = stripAnsi(str);
  let width = 0;
  for (const ch of plain) {
    const code = ch.codePointAt(0)!;
    width += isWideChar(code) ? 2 : 1;
  }
  return width;
}

const ANSI_STICKY = /\x1b\[[0-9;]*m/y;

export function sliceVisible(str: string, maxWidth: number): string {
  let visW = 0;
  let result = '';
  let i = 0;

  while (i < str.length) {
    // Pass through ANSI escape sequences without counting width
    ANSI_STICKY.lastIndex = i;
    const ansiMatch = ANSI_STICKY.exec(str);
    if (ansiMatch) {
      result += ansiMatch[0];
      i = ANSI_STICKY.lastIndex;
      continue;
    }

    const code = str.codePointAt(i)!;
    const charLen = code > 0xffff ? 2 : 1;
    const charWidth = isWideChar(code) ? 2 : 1;

    if (visW + charWidth > maxWidth) break;

    result += str.slice(i, i + charLen);
    visW += charWidth;
    i += charLen;
  }

  return result + '\x1b[0m';
}
