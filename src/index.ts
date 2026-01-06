#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

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
  const transcript = await parseTranscript(transcriptPath);

  const configCounts = await countConfigs(stdin.cwd);
  const gitBranch = await getGitBranch(stdin.cwd);
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
