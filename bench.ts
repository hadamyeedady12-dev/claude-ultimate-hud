#!/usr/bin/env bun
/**
 * HUD Performance Benchmark
 * Measures execution time of the HUD statusline over N runs.
 * Reports: min, median, p95, max (ms)
 */

const RUNS = 20;
const HUD_SCRIPT = `${import.meta.dir}/dist/index.js`;

const STDIN_JSON = JSON.stringify({
  model: { display_name: "Claude Opus 4.6 (1M context)" },
  cwd: "/Users/m4pro/.claude",
  transcript_path: "",
  context_window: {
    context_window_size: 1000000,
    current_usage: {
      input_tokens: 150000,
      cache_creation_input_tokens: 20000,
      cache_read_input_tokens: 30000,
    },
  },
  cost: { total_cost_usd: 1.23 },
  used_percentage: 20,
  total_duration_ms: 360000,
  total_lines_added: 42,
  total_lines_removed: 7,
});

async function runOnce(): Promise<number> {
  const start = performance.now();
  const proc = Bun.spawn(["bun", HUD_SCRIPT], {
    stdin: new Blob([STDIN_JSON]),
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
  return performance.now() - start;
}

// Warm up caches
await runOnce();
await runOnce();

const times: number[] = [];
for (let i = 0; i < RUNS; i++) {
  times.push(await runOnce());
}

times.sort((a, b) => a - b);

const min = times[0];
const median = times[Math.floor(times.length / 2)];
const p95 = times[Math.floor(times.length * 0.95)];
const max = times[times.length - 1];
const avg = times.reduce((a, b) => a + b, 0) / times.length;

console.log(`Runs: ${RUNS}`);
console.log(`Min:    ${min.toFixed(1)}ms`);
console.log(`Median: ${median.toFixed(1)}ms`);
console.log(`Avg:    ${avg.toFixed(1)}ms`);
console.log(`P95:    ${p95.toFixed(1)}ms`);
console.log(`Max:    ${max.toFixed(1)}ms`);

// Output metric for autoresearch (median)
console.log(`\nMETRIC:${median.toFixed(1)}`);
