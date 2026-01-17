#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
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
  const claudeDir = join(homedir(), '.claude');
  try {
    return p.startsWith(claudeDir) && existsSync(p);
  } catch {
    return false;
  }
}

async function readStdin(): Promise<StdinInput | null> {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(content) as StdinInput;
  } catch {
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
  const config = await loadConfig();
  const t = getTranslations(config);

  const stdin = await readStdin();
  if (!stdin) {
    console.log(colorize('⚠️', COLORS.yellow));
    return;
  }

  const transcriptPath = stdin.transcript_path ?? '';
  const validTranscriptPath = isValidTranscriptPath(transcriptPath) ? transcriptPath : '';
  const transcript = await parseTranscript(validTranscriptPath);

  const validCwd = isValidDirectory(stdin.cwd ?? '') ? stdin.cwd : undefined;
  const configCounts = await countConfigs(validCwd);
  const gitBranch = await getGitBranch(validCwd);
  const sessionDuration = formatSessionDuration(transcript.sessionStart);
  const rateLimits = await fetchUsageLimits(config.cache.ttlSeconds);

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

main().catch(() => {
  console.log(colorize('⚠️', COLORS.yellow));
});
