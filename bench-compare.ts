#!/usr/bin/env bun
const RUNS = 15;
const STDIN_JSON = JSON.stringify({
  model: { display_name: "Claude Opus 4.6 (1M context)" },
  cwd: "/Users/m4pro/.claude",
  transcript_path: "",
  context_window: { context_window_size: 1000000, current_usage: { input_tokens: 150000, cache_creation_input_tokens: 20000, cache_read_input_tokens: 30000 } },
  cost: { total_cost_usd: 1.23 },
  used_percentage: 20,
  total_duration_ms: 360000,
  total_lines_added: 42,
  total_lines_removed: 7,
});

async function run(script: string): Promise<number> {
  const start = performance.now();
  const proc = Bun.spawn(["bun", script], { stdin: new Blob([STDIN_JSON]), stdout: "pipe", stderr: "pipe" });
  await proc.exited;
  return performance.now() - start;
}

for (const label of ["src/index.ts", "dist/index.js"]) {
  await run(label); await run(label);
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) times.push(await run(label));
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  console.log(`${label}: median ${median.toFixed(1)}ms`);
}
