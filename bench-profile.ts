#!/usr/bin/env bun
import { readFileSync, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, isAbsolute, resolve, sep } from 'node:path';
import { homedir } from 'node:os';

const home = homedir();
const STDIN_JSON = JSON.stringify({
  model: { display_name: "Claude Opus 4.6 (1M context)" },
  cwd: join(home, '.claude'),
  transcript_path: "",
  context_window: { context_window_size: 1000000, current_usage: { input_tokens: 150000, cache_creation_input_tokens: 20000, cache_read_input_tokens: 30000 } },
  cost: { total_cost_usd: 1.23 },
  used_percentage: 20,
  total_duration_ms: 360000,
  total_lines_added: 42,
  total_lines_removed: 7,
});

// Measure module import time
const t0 = performance.now();
const { DEFAULT_CONFIG } = await import(join(home, '.claude/plugins/claude-ultimate-hud/src/types.js'));
const { fetchUsageLimits } = await import(join(home, '.claude/plugins/claude-ultimate-hud/src/utils/api-client.js'));
const { countConfigs } = await import(join(home, '.claude/plugins/claude-ultimate-hud/src/utils/config-counter.js'));
const { parseTranscript } = await import(join(home, '.claude/plugins/claude-ultimate-hud/src/utils/transcript.js'));
const { getGitInfo } = await import(join(home, '.claude/plugins/claude-ultimate-hud/src/utils/git.js'));
const { getTranslations } = await import(join(home, '.claude/plugins/claude-ultimate-hud/src/utils/i18n.js'));
const { render } = await import(join(home, '.claude/plugins/claude-ultimate-hud/src/render/index.js'));
const t1 = performance.now();
console.log(`Module imports: ${(t1-t0).toFixed(2)}ms`);

// Config load
const t2 = performance.now();
const configPath = join(home, '.claude', 'claude-ultimate-hud.local.json');
const configContent = readFileSync(configPath, 'utf-8');
const config = { ...DEFAULT_CONFIG, ...JSON.parse(configContent) };
const t3 = performance.now();
console.log(`Config load: ${(t3-t2).toFixed(3)}ms`);

// Stdin parse
const t4 = performance.now();
const stdin = JSON.parse(STDIN_JSON);
const t5 = performance.now();
console.log(`Stdin parse: ${(t5-t4).toFixed(3)}ms`);

// Translations
const t6 = performance.now();
const t_ = await getTranslations(config);
const t7 = performance.now();
console.log(`Translations: ${(t7-t6).toFixed(3)}ms`);

// Phase 2
const t8 = performance.now();
const [transcript, configCounts, gitInfo, rateLimits] = await Promise.all([
  parseTranscript(""),
  countConfigs(join(home, '.claude')),
  getGitInfo(join(home, '.claude')),
  fetchUsageLimits(config.cache.ttlSeconds),
]);
const t9 = performance.now();
console.log(`Phase 2 (parallel): ${(t9-t8).toFixed(2)}ms`);

// Render
const t10 = performance.now();
const ctx = {
  stdin, config, transcript, configCounts, gitInfo,
  sessionDuration: '6m',
  rateLimits,
};
// Redirect stdout to suppress output
const origWrite = process.stdout.write;
process.stdout.write = () => true;
render(ctx, t_);
process.stdout.write = origWrite;
const t11 = performance.now();
console.log(`Render: ${(t11-t10).toFixed(3)}ms`);
console.log(`Total (in-process): ${(t11-t0).toFixed(2)}ms`);
