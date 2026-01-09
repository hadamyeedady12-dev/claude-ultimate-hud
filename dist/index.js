#!/usr/bin/env node

// src/index.ts
import { readFile as readFile2 } from "fs/promises";
import { join as join3 } from "path";
import { homedir as homedir3 } from "os";

// src/types.ts
var DEFAULT_CONFIG = {
  language: "ko",
  plan: "max200",
  cache: {
    ttlSeconds: 60
  }
};

// src/utils/colors.ts
var COLORS = {
  reset: "\x1B[0m",
  dim: "\x1B[2m",
  cyan: "\x1B[36m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  red: "\x1B[31m",
  magenta: "\x1B[35m"
};
var RESET = COLORS.reset;
function colorize(text, color) {
  return `${color}${text}${RESET}`;
}
function dim(text) {
  return colorize(text, COLORS.dim);
}
function cyan(text) {
  return colorize(text, COLORS.cyan);
}
function green(text) {
  return colorize(text, COLORS.green);
}
function yellow(text) {
  return colorize(text, COLORS.yellow);
}
function magenta(text) {
  return colorize(text, COLORS.magenta);
}
function getColorForPercent(percent) {
  if (percent <= 50)
    return COLORS.green;
  if (percent <= 80)
    return COLORS.yellow;
  return COLORS.red;
}
function renderProgressBar(percent, width = 10) {
  const filled = Math.round(percent / 100 * width);
  const empty = width - filled;
  const color = getColorForPercent(percent);
  return `${color}${"█".repeat(filled)}${COLORS.dim}${"░".repeat(empty)}${RESET}`;
}

// src/utils/formatters.ts
function formatTokens(n) {
  if (n >= 1e6)
    return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1000)
    return `${Math.round(n / 1000)}K`;
  return n.toString();
}
function formatCost(usd) {
  return `$${usd.toFixed(2)}`;
}
function formatTimeRemaining(resetAt, t) {
  const resetTime = new Date(resetAt).getTime();
  const now = Date.now();
  const diffMs = resetTime - now;
  if (diffMs <= 0)
    return "0m";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor(diffMs % (1000 * 60 * 60) / (1000 * 60));
  if (hours > 0) {
    return `${hours}${t.time.shortHours}${minutes}${t.time.shortMinutes}`;
  }
  return `${minutes}${t.time.shortMinutes}`;
}
function formatSessionDuration(sessionStart, now = () => Date.now()) {
  if (!sessionStart)
    return "";
  const ms = now() - sessionStart.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1)
    return "<1m";
  if (mins < 60)
    return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h${remainingMins}m`;
}
function shortenModelName(name) {
  return name.replace(/^Claude\s*/i, "").trim();
}
function truncate(text, maxLen) {
  if (text.length <= maxLen)
    return text;
  return text.slice(0, maxLen - 3) + "...";
}
function truncatePath(path, maxLen = 20) {
  if (path.length <= maxLen)
    return path;
  const parts = path.split("/");
  const filename = parts.pop() || path;
  if (filename.length >= maxLen)
    return filename.slice(0, maxLen - 3) + "...";
  return ".../" + filename;
}

// src/utils/api-client.ts
import fs from "fs";

// src/utils/credentials.ts
import { execFileSync } from "child_process";
import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
async function getCredentials() {
  try {
    if (process.platform === "darwin") {
      return await getCredentialsFromKeychain();
    }
    return await getCredentialsFromFile();
  } catch {
    return null;
  }
}
async function getCredentialsFromKeychain() {
  try {
    const result = execFileSync("security", ["find-generic-password", "-s", "Claude Code-credentials", "-w"], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    const creds = JSON.parse(result);
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch {
    return await getCredentialsFromFile();
  }
}
async function getCredentialsFromFile() {
  try {
    const credPath = join(homedir(), ".claude", ".credentials.json");
    const content = await readFile(credPath, "utf-8");
    const creds = JSON.parse(content);
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch {
    return null;
  }
}

// src/utils/api-client.ts
var API_TIMEOUT_MS = 5000;
var CACHE_FILE = "/tmp/claude-ultimate-hud-cache.json";
var usageCache = null;
function isCacheValid(ttlSeconds) {
  if (!usageCache)
    return false;
  const ageSeconds = (Date.now() - usageCache.timestamp) / 1000;
  return ageSeconds < ttlSeconds;
}
async function fetchUsageLimits(ttlSeconds = 60) {
  if (isCacheValid(ttlSeconds) && usageCache) {
    return usageCache.data;
  }
  const fileCache = loadFileCache(ttlSeconds);
  if (fileCache) {
    usageCache = { data: fileCache, timestamp: Date.now() };
    return fileCache;
  }
  const token = await getCredentials();
  if (!token)
    return null;
  try {
    const controller = new AbortController;
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "claude-ultimate-hud/1.0.0",
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok)
      return null;
    const data = await response.json();
    const limits = {
      five_hour: data.five_hour ?? null,
      seven_day: data.seven_day ?? null,
      seven_day_sonnet: data.seven_day_sonnet ?? null
    };
    usageCache = { data: limits, timestamp: Date.now() };
    saveFileCache(limits);
    return limits;
  } catch {
    return null;
  }
}
function loadFileCache(ttlSeconds) {
  try {
    if (!fs.existsSync(CACHE_FILE))
      return null;
    const content = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    const ageSeconds = (Date.now() - content.timestamp) / 1000;
    if (ageSeconds < ttlSeconds)
      return content.data;
    return null;
  } catch {
    return null;
  }
}
function saveFileCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

// src/utils/config-counter.ts
import * as fs2 from "fs";
import * as path from "path";
import * as os from "os";
function getMcpServerNames(filePath) {
  if (!fs2.existsSync(filePath))
    return new Set;
  try {
    const content = fs2.readFileSync(filePath, "utf8");
    const config = JSON.parse(content);
    if (config.mcpServers && typeof config.mcpServers === "object") {
      return new Set(Object.keys(config.mcpServers));
    }
  } catch {}
  return new Set;
}
function countMcpServersInFile(filePath, excludeFrom) {
  const servers = getMcpServerNames(filePath);
  if (excludeFrom) {
    const exclude = getMcpServerNames(excludeFrom);
    for (const name of exclude)
      servers.delete(name);
  }
  return servers.size;
}
function countHooksInFile(filePath) {
  if (!fs2.existsSync(filePath))
    return 0;
  try {
    const content = fs2.readFileSync(filePath, "utf8");
    const config = JSON.parse(content);
    if (config.hooks && typeof config.hooks === "object") {
      return Object.keys(config.hooks).length;
    }
  } catch {}
  return 0;
}
function countRulesInDir(rulesDir) {
  if (!fs2.existsSync(rulesDir))
    return 0;
  let count = 0;
  try {
    const entries = fs2.readdirSync(rulesDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(rulesDir, entry.name);
      if (entry.isDirectory()) {
        count += countRulesInDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        count++;
      }
    }
  } catch {}
  return count;
}
function resolvePath(p) {
  try {
    return fs2.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}
async function countConfigs(cwd) {
  let claudeMdCount = 0;
  let rulesCount = 0;
  let mcpCount = 0;
  let hooksCount = 0;
  const homeDir = os.homedir();
  const claudeDir = path.join(homeDir, ".claude");
  const countedPaths = new Set;
  const userClaudeMd = path.join(claudeDir, "CLAUDE.md");
  if (fs2.existsSync(userClaudeMd)) {
    claudeMdCount++;
    countedPaths.add(resolvePath(userClaudeMd));
  }
  const userRulesDir = path.join(claudeDir, "rules");
  rulesCount += countRulesInDir(userRulesDir);
  if (fs2.existsSync(userRulesDir)) {
    countedPaths.add(resolvePath(userRulesDir));
  }
  const userSettings = path.join(claudeDir, "settings.json");
  mcpCount += countMcpServersInFile(userSettings);
  hooksCount += countHooksInFile(userSettings);
  if (fs2.existsSync(userSettings)) {
    countedPaths.add(resolvePath(userSettings));
  }
  const userClaudeJson = path.join(homeDir, ".claude.json");
  mcpCount += countMcpServersInFile(userClaudeJson, userSettings);
  if (cwd) {
    const countFileIfNew = (filePath) => {
      if (!fs2.existsSync(filePath))
        return false;
      const resolved = resolvePath(filePath);
      if (countedPaths.has(resolved))
        return false;
      countedPaths.add(resolved);
      return true;
    };
    if (countFileIfNew(path.join(cwd, "CLAUDE.md")))
      claudeMdCount++;
    if (countFileIfNew(path.join(cwd, "CLAUDE.local.md")))
      claudeMdCount++;
    if (countFileIfNew(path.join(cwd, ".claude", "CLAUDE.md")))
      claudeMdCount++;
    if (countFileIfNew(path.join(cwd, ".claude", "CLAUDE.local.md")))
      claudeMdCount++;
    const projectRulesDir = path.join(cwd, ".claude", "rules");
    if (countFileIfNew(projectRulesDir)) {
      rulesCount += countRulesInDir(projectRulesDir);
    }
    const projectMcpJson = path.join(cwd, ".mcp.json");
    if (countFileIfNew(projectMcpJson)) {
      mcpCount += countMcpServersInFile(projectMcpJson);
    }
    const projectSettings = path.join(cwd, ".claude", "settings.json");
    if (countFileIfNew(projectSettings)) {
      mcpCount += countMcpServersInFile(projectSettings);
      hooksCount += countHooksInFile(projectSettings);
    }
    const localSettings = path.join(cwd, ".claude", "settings.local.json");
    if (countFileIfNew(localSettings)) {
      mcpCount += countMcpServersInFile(localSettings);
      hooksCount += countHooksInFile(localSettings);
    }
  }
  return { claudeMdCount, rulesCount, mcpCount, hooksCount };
}

// src/utils/transcript.ts
import * as fs3 from "fs";
import * as readline from "readline";
async function parseTranscript(transcriptPath) {
  const result = {
    tools: [],
    agents: [],
    todos: []
  };
  if (!transcriptPath || !fs3.existsSync(transcriptPath)) {
    return result;
  }
  const toolMap = new Map;
  const agentMap = new Map;
  let latestTodos = [];
  try {
    const fileStream = fs3.createReadStream(transcriptPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      if (!line.trim())
        continue;
      try {
        const entry = JSON.parse(line);
        processEntry(entry, toolMap, agentMap, latestTodos, result);
      } catch {}
    }
  } catch {}
  result.tools = Array.from(toolMap.values()).slice(-20);
  result.agents = Array.from(agentMap.values()).slice(-10);
  result.todos = latestTodos;
  return result;
}
function processEntry(entry, toolMap, agentMap, latestTodos, result) {
  const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date;
  if (!result.sessionStart && entry.timestamp) {
    result.sessionStart = timestamp;
  }
  const content = entry.message?.content;
  if (!content || !Array.isArray(content))
    return;
  for (const block of content) {
    if (block.type === "tool_use" && block.id && block.name) {
      const toolEntry = {
        name: block.name,
        target: extractTarget(block.name, block.input),
        status: "running",
        startTime: timestamp
      };
      if (block.name === "Task") {
        const input = block.input;
        const agentEntry = {
          type: input?.subagent_type ?? "unknown",
          model: input?.model ?? undefined,
          description: input?.description ?? undefined,
          status: "running",
          startTime: timestamp
        };
        agentMap.set(block.id, agentEntry);
      } else if (block.name === "TodoWrite") {
        const input = block.input;
        if (input?.todos && Array.isArray(input.todos)) {
          latestTodos.length = 0;
          latestTodos.push(...input.todos);
        }
      } else {
        toolMap.set(block.id, toolEntry);
      }
    }
    if (block.type === "tool_result" && block.tool_use_id) {
      const tool = toolMap.get(block.tool_use_id);
      if (tool) {
        tool.status = block.is_error ? "error" : "completed";
        tool.endTime = timestamp;
      }
      const agent = agentMap.get(block.tool_use_id);
      if (agent) {
        agent.status = "completed";
        agent.endTime = timestamp;
      }
    }
  }
}
function extractTarget(toolName, input) {
  if (!input)
    return;
  switch (toolName) {
    case "Read":
    case "Write":
    case "Edit":
      return input.file_path ?? input.path;
    case "Glob":
    case "Grep":
      return input.pattern;
    case "Bash": {
      const cmd = input.command;
      return cmd?.slice(0, 30) + (cmd?.length > 30 ? "..." : "");
    }
  }
  return;
}

// src/utils/git.ts
import { execFileSync as execFileSync2 } from "child_process";
async function getGitBranch(cwd) {
  if (!cwd)
    return;
  try {
    const result = execFileSync2("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return result || undefined;
  } catch {
    return;
  }
}

// src/utils/i18n.ts
var EN = {
  labels: {
    "5h": "5h",
    "7d_all": "7d(all)",
    "7d_sonnet": "7d(Sonnet)"
  },
  time: {
    hours: " hours",
    minutes: " minutes",
    shortHours: "h",
    shortMinutes: "m"
  },
  errors: {
    no_context: "No context data"
  }
};
var KO = {
  labels: {
    "5h": "5시간",
    "7d_all": "7일(all)",
    "7d_sonnet": "7일(소넷)"
  },
  time: {
    hours: "시간",
    minutes: "분",
    shortHours: "시간",
    shortMinutes: "분"
  },
  errors: {
    no_context: "컨텍스트 데이터 없음"
  }
};
function detectLanguage() {
  const lang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || "";
  if (lang.toLowerCase().startsWith("ko"))
    return "ko";
  return "en";
}
function getTranslations(config) {
  const lang = config.language === "auto" ? detectLanguage() : config.language;
  return lang === "ko" ? KO : EN;
}

// src/constants.ts
var AUTOCOMPACT_BUFFER = 45000;

// src/render/session-line.ts
var SEP = ` ${COLORS.dim}│${RESET} `;
function renderSessionLine(ctx, t) {
  const parts = [];
  const modelName = shortenModelName(ctx.stdin.model.display_name);
  parts.push(`${COLORS.cyan}\uD83E\uDD16 ${modelName}${RESET}`);
  const usage = ctx.stdin.context_window.current_usage;
  if (!usage) {
    parts.push(colorize(t.errors.no_context, COLORS.dim));
    return parts.join(SEP);
  }
  const baseTokens = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
  const totalTokens = ctx.stdin.context_window.context_window_size;
  const currentTokens = baseTokens + AUTOCOMPACT_BUFFER;
  const percent = Math.min(100, Math.round(currentTokens / totalTokens * 100));
  parts.push(renderProgressBar(percent));
  const percentColor = getColorForPercent(percent);
  parts.push(colorize(`${percent}%`, percentColor));
  parts.push(`${formatTokens(currentTokens)}/${formatTokens(totalTokens)}`);
  parts.push(colorize(formatCost(ctx.stdin.cost.total_cost_usd), COLORS.yellow));
  const rateParts = buildRateLimitsSection(ctx, t);
  if (rateParts) {
    parts.push(rateParts);
  }
  return parts.join(SEP);
}
function buildRateLimitsSection(ctx, t) {
  const limits = ctx.rateLimits;
  if (!limits)
    return colorize("⚠️", COLORS.yellow);
  const parts = [];
  if (limits.five_hour) {
    const pct = Math.round(limits.five_hour.utilization);
    const color = getColorForPercent(pct);
    let text = `${t.labels["5h"]}: ${colorize(`${pct}%`, color)}`;
    if (limits.five_hour.resets_at) {
      const remaining = formatTimeRemaining(limits.five_hour.resets_at, t);
      text += ` (${remaining})`;
    }
    parts.push(text);
  }
  const plan = ctx.config.plan;
  const showSevenDay = plan === "max100" || plan === "max200";
  const showSevenDaySonnet = plan === "max100" || plan === "max200";
  if (showSevenDay && limits.seven_day) {
    const pct = Math.round(limits.seven_day.utilization);
    const color = getColorForPercent(pct);
    parts.push(`${t.labels["7d_all"]}: ${colorize(`${pct}%`, color)}`);
  }
  if (showSevenDaySonnet && limits.seven_day_sonnet) {
    const pct = Math.round(limits.seven_day_sonnet.utilization);
    const color = getColorForPercent(pct);
    parts.push(`${t.labels["7d_sonnet"]}: ${colorize(`${pct}%`, color)}`);
  }
  return parts.length > 0 ? parts.join(SEP) : null;
}

// src/render/project-line.ts
import path2 from "node:path";
var SEP2 = ` ${COLORS.dim}│${RESET} `;
function renderProjectLine(ctx) {
  const parts = [];
  if (ctx.stdin.cwd) {
    const projectName = path2.basename(ctx.stdin.cwd) || ctx.stdin.cwd;
    let projectPart = `\uD83D\uDCC1 ${yellow(projectName)}`;
    if (ctx.gitBranch) {
      projectPart += ` ${magenta("git:(")}${cyan(ctx.gitBranch)}${magenta(")")}`;
    }
    parts.push(projectPart);
  }
  const { configCounts } = ctx;
  if (configCounts.claudeMdCount > 0) {
    parts.push(dim(`${configCounts.claudeMdCount} CLAUDE.md`));
  }
  if (configCounts.rulesCount > 0) {
    parts.push(dim(`${configCounts.rulesCount} rules`));
  }
  if (configCounts.mcpCount > 0) {
    parts.push(dim(`${configCounts.mcpCount} MCPs`));
  }
  if (configCounts.hooksCount > 0) {
    parts.push(dim(`${configCounts.hooksCount} hooks`));
  }
  if (ctx.sessionDuration) {
    parts.push(dim(`⏱️ ${ctx.sessionDuration}`));
  }
  return parts.join(SEP2);
}

// src/render/activity-lines.ts
var SEP3 = ` ${COLORS.dim}│${RESET} `;
function renderToolsLine(ctx) {
  const { tools } = ctx.transcript;
  if (tools.length === 0)
    return null;
  const parts = [];
  const runningTools = tools.filter((t) => t.status === "running");
  const completedTools = tools.filter((t) => t.status === "completed" || t.status === "error");
  for (const tool of runningTools.slice(-2)) {
    const target = tool.target ? truncatePath(tool.target) : "";
    parts.push(`${yellow("◐")} ${cyan(tool.name)}${target ? dim(`: ${target}`) : ""}`);
  }
  const toolCounts = new Map;
  for (const tool of completedTools) {
    const count = toolCounts.get(tool.name) ?? 0;
    toolCounts.set(tool.name, count + 1);
  }
  const sortedTools = Array.from(toolCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  for (const [name, count] of sortedTools) {
    parts.push(`${green("✓")} ${name} ${dim(`×${count}`)}`);
  }
  return parts.length > 0 ? parts.join(" | ") : null;
}
function renderAgentsLine(ctx) {
  const { agents } = ctx.transcript;
  const runningAgents = agents.filter((a) => a.status === "running");
  const recentCompleted = agents.filter((a) => a.status === "completed").slice(-2);
  const toShow = [...runningAgents, ...recentCompleted].slice(-3);
  if (toShow.length === 0)
    return null;
  const lines = [];
  for (const agent of toShow) {
    lines.push(formatAgent(agent));
  }
  return lines.join(`
`);
}
function formatAgent(agent) {
  const statusIcon = agent.status === "running" ? yellow("◐") : green("✓");
  const type = magenta(agent.type);
  const model = agent.model ? dim(`[${agent.model}]`) : "";
  const desc = agent.description ? dim(`: ${truncate(agent.description, 40)}`) : "";
  const elapsed = formatElapsed(agent);
  return `${statusIcon} ${type}${model ? ` ${model}` : ""}${desc} ${dim(`(${elapsed})`)}`;
}
function formatElapsed(agent) {
  const now = Date.now();
  const start = agent.startTime.getTime();
  const end = agent.endTime?.getTime() ?? now;
  const ms = end - start;
  if (ms < 1000)
    return "<1s";
  if (ms < 60000)
    return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round(ms % 60000 / 1000);
  return `${mins}m${secs}s`;
}
function renderTodosLine(ctx) {
  const { todos } = ctx.transcript;
  if (!todos || todos.length === 0)
    return null;
  const inProgress = todos.find((t) => t.status === "in_progress");
  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;
  if (!inProgress) {
    if (completed === total && total > 0) {
      return `${green("✓")} All todos complete ${dim(`(${completed}/${total})`)}`;
    }
    return null;
  }
  const content = truncate(inProgress.content, 50);
  const progress = dim(`(${completed}/${total})`);
  return `${yellow("▸")} ${content} ${progress}`;
}

// src/render/index.ts
function render(ctx, t) {
  const lines = [];
  const sessionLine = renderSessionLine(ctx, t);
  if (sessionLine)
    lines.push(sessionLine);
  const projectLine = renderProjectLine(ctx);
  if (projectLine)
    lines.push(projectLine);
  const toolsLine = renderToolsLine(ctx);
  if (toolsLine)
    lines.push(toolsLine);
  const agentsLine = renderAgentsLine(ctx);
  if (agentsLine)
    lines.push(agentsLine);
  const todosLine = renderTodosLine(ctx);
  if (todosLine)
    lines.push(todosLine);
  for (const line of lines) {
    const outputLine = `${RESET}${line.replace(/ /g, " ")}`;
    console.log(outputLine);
  }
}

// src/index.ts
var CONFIG_PATH = join3(homedir3(), ".claude", "claude-ultimate-hud.local.json");
async function readStdin() {
  try {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString("utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
async function loadConfig() {
  try {
    const content = await readFile2(CONFIG_PATH, "utf-8");
    const userConfig = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch {
    return DEFAULT_CONFIG;
  }
}
async function main() {
  const config = await loadConfig();
  const t = getTranslations(config);
  const stdin = await readStdin();
  if (!stdin) {
    console.log(colorize("⚠️", COLORS.yellow));
    return;
  }
  const transcriptPath = stdin.transcript_path ?? "";
  const transcript = await parseTranscript(transcriptPath);
  const configCounts = await countConfigs(stdin.cwd);
  const gitBranch = await getGitBranch(stdin.cwd);
  const sessionDuration = formatSessionDuration(transcript.sessionStart);
  const rateLimits = await fetchUsageLimits(config.cache.ttlSeconds);
  const ctx = {
    stdin,
    config,
    transcript,
    configCounts,
    gitBranch,
    sessionDuration,
    rateLimits
  };
  render(ctx, t);
}
main().catch(() => {
  console.log(colorize("⚠️", COLORS.yellow));
});
