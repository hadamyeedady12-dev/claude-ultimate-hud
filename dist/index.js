#!/usr/bin/env node

// src/index.ts
import { readFile as readFile2 } from "node:fs/promises";
import { join as join3, isAbsolute } from "node:path";
import { homedir as homedir3 } from "node:os";
import { existsSync as existsSync4, statSync as statSync2 } from "node:fs";

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
  if (percent <= 50) return COLORS.green;
  if (percent <= 80) return COLORS.yellow;
  return COLORS.red;
}
function renderProgressBar(percent, width = 10) {
  const filled = Math.round(percent / 100 * width);
  const empty = width - filled;
  const color = getColorForPercent(percent);
  return `${color}${"\u2588".repeat(filled)}${COLORS.dim}${"\u2591".repeat(empty)}${RESET}`;
}

// src/utils/formatters.ts
import path from "node:path";
function formatTokens(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return n.toString();
}
function formatTimeRemaining(resetAt, t) {
  const resetTime = new Date(resetAt).getTime();
  const now = Date.now();
  const diffMs = resetTime - now;
  if (diffMs <= 0) return "0m";
  const hours = Math.floor(diffMs / (1e3 * 60 * 60));
  const minutes = Math.floor(diffMs % (1e3 * 60 * 60) / (1e3 * 60));
  if (hours > 0) {
    return `${hours}${t.time.shortHours}${minutes}${t.time.shortMinutes}`;
  }
  return `${minutes}${t.time.shortMinutes}`;
}
function formatSessionDuration(sessionStart, now = () => Date.now()) {
  if (!sessionStart) return "";
  const ms = now() - sessionStart.getTime();
  const mins = Math.floor(ms / 6e4);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h${remainingMins}m`;
}
function shortenModelName(name) {
  return name.replace(/^Claude\s*/i, "").trim();
}
function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}
function truncatePath(filePath, maxLen = 20) {
  if (filePath.length <= maxLen) return filePath;
  const parts = filePath.split(/[/\\]/);
  const filename = parts.pop() || filePath;
  if (filename.length >= maxLen) return filename.slice(0, maxLen - 3) + "...";
  return "..." + path.sep + filename;
}

// src/utils/api-client.ts
import fs from "node:fs";
import os from "node:os";
import path2 from "node:path";

// src/utils/credentials.ts
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
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
    const result = execFileSync(
      "security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
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
var API_TIMEOUT_MS = 5e3;
var CACHE_DIR = path2.join(os.homedir(), ".claude");
var CACHE_FILE = path2.join(CACHE_DIR, "claude-ultimate-hud-cache.json");
var usageCache = null;
function isCacheValid(ttlSeconds) {
  if (!usageCache) return false;
  const ageSeconds = (Date.now() - usageCache.timestamp) / 1e3;
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
  let token = await getCredentials();
  if (!token) return null;
  try {
    const controller = new AbortController();
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
    token = null;
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    const limits = {
      five_hour: data.five_hour,
      seven_day: data.seven_day,
      seven_day_sonnet: data.seven_day_sonnet
    };
    usageCache = { data: limits, timestamp: Date.now() };
    saveFileCache(limits);
    return limits;
  } catch {
    token = null;
    return null;
  }
}
function loadFileCache(ttlSeconds) {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const content = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    const ageSeconds = (Date.now() - content.timestamp) / 1e3;
    if (ageSeconds < ttlSeconds) return content.data;
    return null;
  } catch {
    return null;
  }
}
function saveFileCache(data) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 448 });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ data, timestamp: Date.now() }), { mode: 384 });
  } catch {
  }
}

// src/utils/config-counter.ts
import * as fs2 from "node:fs";
import * as path3 from "node:path";
import * as os2 from "node:os";
function readJsonFile(filePath) {
  if (!fs2.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs2.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}
function getMcpServerNames(filePath) {
  const config = readJsonFile(filePath);
  if (config?.mcpServers && typeof config.mcpServers === "object") {
    return new Set(Object.keys(config.mcpServers));
  }
  return /* @__PURE__ */ new Set();
}
function countMcpServersInFile(filePath, excludeFrom) {
  const servers = getMcpServerNames(filePath);
  if (excludeFrom) {
    const exclude = getMcpServerNames(excludeFrom);
    for (const name of exclude) servers.delete(name);
  }
  return servers.size;
}
function countHooksInFile(filePath) {
  const config = readJsonFile(filePath);
  if (config?.hooks && typeof config.hooks === "object") {
    return Object.keys(config.hooks).length;
  }
  return 0;
}
var MAX_RECURSION_DEPTH = 10;
function countRulesInDir(rulesDir, depth = 0, visited = /* @__PURE__ */ new Set()) {
  if (!fs2.existsSync(rulesDir)) return 0;
  if (depth > MAX_RECURSION_DEPTH) return 0;
  let realPath;
  try {
    realPath = fs2.realpathSync(rulesDir);
    if (visited.has(realPath)) return 0;
    visited.add(realPath);
  } catch {
    return 0;
  }
  let count = 0;
  try {
    const entries = fs2.readdirSync(rulesDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path3.join(rulesDir, entry.name);
      if (entry.isDirectory()) {
        count += countRulesInDir(fullPath, depth + 1, visited);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        count++;
      }
    }
  } catch {
  }
  return count;
}
function resolvePath(p) {
  try {
    return fs2.realpathSync(p);
  } catch {
    return path3.resolve(p);
  }
}
async function countConfigs(cwd) {
  let claudeMdCount = 0;
  let rulesCount = 0;
  let mcpCount = 0;
  let hooksCount = 0;
  const homeDir = os2.homedir();
  const claudeDir = path3.join(homeDir, ".claude");
  const countedPaths = /* @__PURE__ */ new Set();
  const userClaudeMd = path3.join(claudeDir, "CLAUDE.md");
  if (fs2.existsSync(userClaudeMd)) {
    claudeMdCount++;
    countedPaths.add(resolvePath(userClaudeMd));
  }
  const userRulesDir = path3.join(claudeDir, "rules");
  rulesCount += countRulesInDir(userRulesDir);
  if (fs2.existsSync(userRulesDir)) {
    countedPaths.add(resolvePath(userRulesDir));
  }
  const userSettings = path3.join(claudeDir, "settings.json");
  mcpCount += countMcpServersInFile(userSettings);
  hooksCount += countHooksInFile(userSettings);
  if (fs2.existsSync(userSettings)) {
    countedPaths.add(resolvePath(userSettings));
  }
  const userClaudeJson = path3.join(homeDir, ".claude.json");
  mcpCount += countMcpServersInFile(userClaudeJson, userSettings);
  if (cwd) {
    const countFileIfNew = (filePath) => {
      if (!fs2.existsSync(filePath)) return false;
      const resolved = resolvePath(filePath);
      if (countedPaths.has(resolved)) return false;
      countedPaths.add(resolved);
      return true;
    };
    if (countFileIfNew(path3.join(cwd, "CLAUDE.md"))) claudeMdCount++;
    if (countFileIfNew(path3.join(cwd, "CLAUDE.local.md"))) claudeMdCount++;
    if (countFileIfNew(path3.join(cwd, ".claude", "CLAUDE.md"))) claudeMdCount++;
    if (countFileIfNew(path3.join(cwd, ".claude", "CLAUDE.local.md"))) claudeMdCount++;
    const projectRulesDir = path3.join(cwd, ".claude", "rules");
    if (countFileIfNew(projectRulesDir)) {
      rulesCount += countRulesInDir(projectRulesDir);
    }
    const projectMcpJson = path3.join(cwd, ".mcp.json");
    if (countFileIfNew(projectMcpJson)) {
      mcpCount += countMcpServersInFile(projectMcpJson);
    }
    const projectSettings = path3.join(cwd, ".claude", "settings.json");
    if (countFileIfNew(projectSettings)) {
      mcpCount += countMcpServersInFile(projectSettings);
      hooksCount += countHooksInFile(projectSettings);
    }
    const localSettings = path3.join(cwd, ".claude", "settings.local.json");
    if (countFileIfNew(localSettings)) {
      mcpCount += countMcpServersInFile(localSettings);
      hooksCount += countHooksInFile(localSettings);
    }
  }
  return { claudeMdCount, rulesCount, mcpCount, hooksCount };
}

// src/utils/transcript.ts
import * as fs3 from "node:fs";
import * as readline from "node:readline";
async function parseTranscript(transcriptPath) {
  const result = {
    tools: [],
    agents: [],
    todos: []
  };
  if (!transcriptPath || !fs3.existsSync(transcriptPath)) {
    return result;
  }
  const toolMap = /* @__PURE__ */ new Map();
  const agentMap = /* @__PURE__ */ new Map();
  let latestTodos = [];
  try {
    const fileStream = fs3.createReadStream(transcriptPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        processEntry(entry, toolMap, agentMap, latestTodos, result);
      } catch {
      }
    }
  } catch {
  }
  result.tools = Array.from(toolMap.values()).slice(-20);
  result.agents = Array.from(agentMap.values()).slice(-10);
  result.todos = latestTodos;
  return result;
}
function processEntry(entry, toolMap, agentMap, latestTodos, result) {
  const timestamp = entry.timestamp ? new Date(entry.timestamp) : /* @__PURE__ */ new Date();
  if (!result.sessionStart && entry.timestamp) {
    result.sessionStart = timestamp;
  }
  const content = entry.message?.content;
  if (!content || !Array.isArray(content)) return;
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
          model: input?.model ?? void 0,
          description: input?.description ?? void 0,
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
  if (!input) return void 0;
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
  return void 0;
}

// src/utils/git.ts
import { execFileSync as execFileSync2 } from "node:child_process";
import { existsSync as existsSync3, statSync } from "node:fs";
async function getGitBranch(cwd) {
  if (!cwd) return void 0;
  try {
    if (!existsSync3(cwd) || !statSync(cwd).isDirectory()) {
      return void 0;
    }
  } catch {
    return void 0;
  }
  try {
    const result = execFileSync2("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return result || void 0;
  } catch {
    return void 0;
  }
}

// src/utils/i18n.ts
var EN = {
  labels: {
    "5h": "5h",
    "7d": "7d",
    "7d_all": "all",
    "7d_sonnet": "Sonnet"
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
    "5h": "5\uC2DC\uAC04",
    "7d": "7\uC77C",
    "7d_all": "\uC804\uCCB4",
    "7d_sonnet": "\uC18C\uB137"
  },
  time: {
    hours: "\uC2DC\uAC04",
    minutes: "\uBD84",
    shortHours: "\uC2DC\uAC04",
    shortMinutes: "\uBD84"
  },
  errors: {
    no_context: "\uCEE8\uD14D\uC2A4\uD2B8 \uB370\uC774\uD130 \uC5C6\uC74C"
  }
};
function detectLanguage() {
  const lang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || "";
  if (lang.toLowerCase().startsWith("ko")) return "ko";
  return "en";
}
function getTranslations(config) {
  const lang = config.language === "auto" ? detectLanguage() : config.language;
  return lang === "ko" ? KO : EN;
}

// src/constants.ts
var AUTOCOMPACT_BUFFER = 45e3;

// src/render/session-line.ts
var SEP = ` ${COLORS.dim}\u2502${RESET} `;
function renderSessionLine(ctx, t) {
  const parts = [];
  const modelName = shortenModelName(ctx.stdin.model.display_name);
  parts.push(`${COLORS.cyan}\u{1F916} ${modelName}${RESET}`);
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
  const rateParts = buildRateLimitsSection(ctx, t);
  if (rateParts) {
    parts.push(rateParts);
  }
  return parts.join(SEP);
}
function buildRateLimitsSection(ctx, t) {
  const limits = ctx.rateLimits;
  if (!limits) return colorize("\u26A0\uFE0F", COLORS.yellow);
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
  const isMaxPlan = ctx.config.plan === "max100" || ctx.config.plan === "max200";
  if (isMaxPlan && (limits.seven_day || limits.seven_day_sonnet)) {
    const sevenDayParts = [];
    if (limits.seven_day) {
      const pct = Math.round(limits.seven_day.utilization);
      const color = getColorForPercent(pct);
      sevenDayParts.push(`${t.labels["7d_all"]} ${colorize(`${pct}%`, color)}`);
    }
    if (limits.seven_day_sonnet) {
      const pct = Math.round(limits.seven_day_sonnet.utilization);
      const color = getColorForPercent(pct);
      sevenDayParts.push(`${t.labels["7d_sonnet"]} ${colorize(`${pct}%`, color)}`);
    }
    if (sevenDayParts.length > 0) {
      parts.push(`${t.labels["7d"]}: ${sevenDayParts.join(" / ")}`);
    }
  }
  return parts.length > 0 ? parts.join(SEP) : null;
}

// src/render/project-line.ts
import path4 from "node:path";
var SEP2 = ` ${COLORS.dim}\u2502${RESET} `;
function renderProjectLine(ctx) {
  const parts = [];
  if (ctx.stdin.cwd) {
    const projectName = path4.basename(ctx.stdin.cwd) || ctx.stdin.cwd;
    let projectPart = `\u{1F4C1} ${yellow(projectName)}`;
    if (ctx.gitBranch) {
      projectPart += ` ${magenta("git:(")}${cyan(ctx.gitBranch)}${magenta(")")}`;
    }
    parts.push(projectPart);
  }
  const { claudeMdCount, rulesCount, mcpCount, hooksCount } = ctx.configCounts;
  const configItems = [
    [claudeMdCount, "CLAUDE.md"],
    [rulesCount, "rules"],
    [mcpCount, "MCPs"],
    [hooksCount, "hooks"]
  ];
  for (const [count, label] of configItems) {
    if (count > 0) {
      parts.push(dim(`${count} ${label}`));
    }
  }
  if (ctx.sessionDuration) {
    parts.push(dim(`\u23F1\uFE0F ${ctx.sessionDuration}`));
  }
  return parts.join(SEP2);
}

// src/render/activity-lines.ts
function renderToolsLine(ctx) {
  const { tools } = ctx.transcript;
  if (tools.length === 0) return null;
  const parts = [];
  const runningTools = tools.filter((t) => t.status === "running");
  const completedTools = tools.filter((t) => t.status === "completed" || t.status === "error");
  for (const tool of runningTools.slice(-2)) {
    const target = tool.target ? truncatePath(tool.target) : "";
    parts.push(`${yellow("\u25D0")} ${cyan(tool.name)}${target ? dim(`: ${target}`) : ""}`);
  }
  const toolCounts = /* @__PURE__ */ new Map();
  for (const tool of completedTools) {
    const count = toolCounts.get(tool.name) ?? 0;
    toolCounts.set(tool.name, count + 1);
  }
  const sortedTools = Array.from(toolCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  for (const [name, count] of sortedTools) {
    parts.push(`${green("\u2713")} ${name} ${dim(`\xD7${count}`)}`);
  }
  return parts.length > 0 ? parts.join(" | ") : null;
}
function renderAgentsLine(ctx) {
  const { agents } = ctx.transcript;
  const runningAgents = agents.filter((a) => a.status === "running");
  const recentCompleted = agents.filter((a) => a.status === "completed").slice(-2);
  const toShow = [...runningAgents, ...recentCompleted].slice(-3);
  if (toShow.length === 0) return null;
  const lines = [];
  for (const agent of toShow) {
    lines.push(formatAgent(agent));
  }
  return lines.join("\n");
}
function formatAgent(agent) {
  const statusIcon = agent.status === "running" ? yellow("\u25D0") : green("\u2713");
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
  if (ms < 1e3) return "<1s";
  if (ms < 6e4) return `${Math.round(ms / 1e3)}s`;
  const mins = Math.floor(ms / 6e4);
  const secs = Math.round(ms % 6e4 / 1e3);
  return `${mins}m${secs}s`;
}
function renderTodosLine(ctx) {
  const { todos } = ctx.transcript;
  if (!todos || todos.length === 0) return null;
  const inProgress = todos.find((t) => t.status === "in_progress");
  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;
  if (!inProgress) {
    if (completed === total && total > 0) {
      return `${green("\u2713")} All todos complete ${dim(`(${completed}/${total})`)}`;
    }
    return null;
  }
  const content = truncate(inProgress.content, 50);
  const progress = dim(`(${completed}/${total})`);
  return `${yellow("\u25B8")} ${content} ${progress}`;
}

// src/render/index.ts
function render(ctx, t) {
  const lines = [
    renderSessionLine(ctx, t),
    renderProjectLine(ctx),
    renderToolsLine(ctx),
    renderAgentsLine(ctx),
    renderTodosLine(ctx)
  ].filter(Boolean);
  for (const line of lines) {
    console.log(`${RESET}${line.replace(/ /g, "\xA0")}`);
  }
}

// src/index.ts
var CONFIG_PATH = join3(homedir3(), ".claude", "claude-ultimate-hud.local.json");
function isValidDirectory(p) {
  if (!p || !isAbsolute(p)) return false;
  try {
    return existsSync4(p) && statSync2(p).isDirectory();
  } catch {
    return false;
  }
}
function isValidTranscriptPath(p) {
  if (!p) return true;
  if (!isAbsolute(p)) return false;
  const claudeDir = join3(homedir3(), ".claude");
  try {
    return p.startsWith(claudeDir) && existsSync4(p);
  } catch {
    return false;
  }
}
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
    console.log(colorize("\u26A0\uFE0F", COLORS.yellow));
    return;
  }
  const transcriptPath = stdin.transcript_path ?? "";
  const validTranscriptPath = isValidTranscriptPath(transcriptPath) ? transcriptPath : "";
  const transcript = await parseTranscript(validTranscriptPath);
  const validCwd = isValidDirectory(stdin.cwd ?? "") ? stdin.cwd : void 0;
  const configCounts = await countConfigs(validCwd);
  const gitBranch = await getGitBranch(validCwd);
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
  console.log(colorize("\u26A0\uFE0F", COLORS.yellow));
});
