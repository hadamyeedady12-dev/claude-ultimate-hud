#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { join, isAbsolute, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, statSync } from 'node:fs';

import type { StdinInput, Config, RenderContext } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { COLORS, colorize } from './utils/colors.js';
import { formatSessionDuration } from './utils/formatters.js';
import { fetchUsageLimits } from './utils/api-client.js';
import { countConfigs } from './utils/config-counter.js';
import { parseTranscript } from './utils/transcript.js';
import { getGitBranch } from './utils/git.js';
import { getTranslations } from './utils/i18n.js';
import { render } from './render/index.js';
import { debugError } from './utils/errors.js';
import { STDIN_TIMEOUT_MS } from './constants.js';

const CONFIG_PATH = join(homedir(), '.claude', 'claude-ultimate-hud.local.json');

function isValidDirectory(p: string): boolean {
  if (!p || !isAbsolute(p)) return false;
  try {
    return existsSync(p) && statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isValidTranscriptPath(p: string): boolean {
  if (!p) return true; // Empty path is allowed
  if (!isAbsolute(p)) return false;
  // Only allow paths within ~/.claude directory
  // Use resolve() to normalize ".." segments and compare with trailing sep to prevent prefix collisions
  const claudeDir = join(homedir(), '.claude');
  try {
    const resolved = resolve(p);
    return (resolved === claudeDir || resolved.startsWith(claudeDir + sep)) && existsSync(resolved);
  } catch {
    return false;
  }
}

async function readStdin(): Promise<StdinInput | null> {
  try {
    const chunks: Buffer[] = [];
    const stdinRead = (async () => {
      for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk));
      }
    })();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('stdin timeout')), STDIN_TIMEOUT_MS)
    );
    await Promise.race([stdinRead, timeout]);
    const content = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(content) as StdinInput;
  } catch (e) {
    debugError('stdin read', e);
    return null;
  }
}

async function loadConfig(): Promise<Config> {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8');
    const userConfig = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function main(): Promise<void> {
  // Phase 1: Load config and read stdin in parallel
  const [config, stdin] = await Promise.all([loadConfig(), readStdin()]);
  const t = await getTranslations(config);

  if (!stdin) {
    console.log(colorize('⚠️ stdin', COLORS.yellow));
    return;
  }

  const transcriptPath = stdin.transcript_path ?? '';
  const validTranscriptPath = isValidTranscriptPath(transcriptPath) ? transcriptPath : '';
  const validCwd = isValidDirectory(stdin.cwd ?? '') ? stdin.cwd : undefined;

  // Phase 2: Run all independent I/O operations in parallel
  const [transcript, configCounts, gitBranch, rateLimits] = await Promise.all([
    parseTranscript(validTranscriptPath),
    countConfigs(validCwd),
    getGitBranch(validCwd),
    fetchUsageLimits(config.cache.ttlSeconds),
  ]);

  const sessionDuration = formatSessionDuration(transcript.sessionStart);

  const ctx: RenderContext = {
    stdin,
    config,
    transcript,
    configCounts,
    gitBranch,
    sessionDuration,
    rateLimits,
  };

  render(ctx, t);
}

main().catch((e) => {
  debugError('main', e);
  console.log(colorize('⚠️', COLORS.yellow));
});
