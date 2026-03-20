#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const RUNS = 50;
const home = homedir();

// Simulate cache file reads
const cacheFiles = [
  join(home, '.claude', 'claude-ultimate-hud-cache.json'),
  join(home, '.claude', 'claude-ultimate-hud-ncache.json'),
  join(home, '.claude', 'claude-ultimate-hud-config-cache.json'),
  join(home, '.claude', 'claude-ultimate-hud-git-cache.json'),
  join(home, '.claude', 'claude-ultimate-hud-transcript-cache.json'),
  join(home, '.claude', 'claude-ultimate-hud.local.json'),
];

for (const file of cacheFiles) {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    try {
      const raw = readFileSync(file, 'utf-8');
      JSON.parse(raw);
    } catch {}
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const basename = file.split('/').pop();
  console.log(`${basename}: ${median.toFixed(3)}ms`);
}
