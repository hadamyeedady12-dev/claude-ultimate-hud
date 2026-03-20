#!/usr/bin/env bun
const RUNS = 15;
const STDIN_JSON = '{"model":{"display_name":"X"},"context_window":{"context_window_size":1},"cost":{"total_cost_usd":0}}';

async function run(script: string): Promise<number> {
  const start = performance.now();
  const proc = Bun.spawn(["bun", "-e", "process.stdin.resume();process.stdin.on('end',()=>process.exit(0))"], { stdin: new Blob([STDIN_JSON]), stdout: "pipe", stderr: "pipe" });
  await proc.exited;
  return performance.now() - start;
}

// warmup
await run(""); await run("");
const times: number[] = [];
for (let i = 0; i < RUNS; i++) times.push(await run(""));
times.sort((a, b) => a - b);
console.log(`Bun noop (stdin pipe): median ${times[Math.floor(times.length/2)].toFixed(1)}ms`);
