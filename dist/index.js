#!/usr/bin/env node

// src/index.ts
import { readFile as readFile2 } from "node:fs/promises";
import { join as join4, isAbsolute, resolve as resolve2, sep } from "node:path";
import { homedir as homedir3 } from "node:os";
import { existsSync as existsSync5, statSync as statSync3 } from "node:fs";

// src/types.ts
var DEFAULT_CONFIG = {
  language: "ko",
  plan: "max200",
  cache: {
    ttlSeconds: 60
  }
};

// src/constants.ts
var AUTOCOMPACT_BUFFER = 0;
var PROGRESS_BAR_WIDTH = 10;
var MAX_RUNNING_TOOLS = 2;
var MAX_COMPLETED_TOOL_TYPES = 4;
var MAX_AGENTS_DISPLAY = 3;
var MAX_COMPLETED_AGENTS = 2;
var MAX_AGENT_DESC_LENGTH = 40;
var MAX_TODO_CONTENT_LENGTH = 50;
var MAX_TRANSCRIPT_TOOLS = 20;
var MAX_TRANSCRIPT_AGENTS = 10;
var STDIN_TIMEOUT_MS = 5000;
var EXEC_TIMEOUT_MS = 3000;
var API_TIMEOUT_MS = 5000;

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
function renderProgressBar(percent, width = PROGRESS_BAR_WIDTH) {
  const filled = Math.round(percent / 100 * width);
  const empty = width - filled;
  const color = getColorForPercent(percent);
  return `${color}${"█".repeat(filled)}${COLORS.dim}${"░".repeat(empty)}${RESET}`;
}

// src/utils/formatters.ts
import path from "node:path";
function formatTokens(n) {
  if (n >= 1e6)
    return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1000)
    return `${Math.round(n / 1000)}K`;
  return n.toString();
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
function truncatePath(filePath, maxLen = 20) {
  if (filePath.length <= maxLen)
    return filePath;
  const parts = filePath.split(/[/\\]/);
  const filename = parts.pop() || filePath;
  if (filename.length >= maxLen)
    return filename.slice(0, maxLen - 3) + "...";
  return "..." + path.sep + filename;
}

// src/utils/api-client.ts
import fs from "node:fs";
import os from "node:os";
import path2 from "node:path";
import crypto from "node:crypto";

// src/utils/credentials.ts
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// src/utils/errors.ts
var IS_DEBUG = process.env.CLAUDE_HUD_DEBUG === "1";
function debugError(context, error) {
  if (!IS_DEBUG)
    return;
  const msg = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[claude-ultimate-hud] ${context}: ${msg}
`);
}

// src/utils/credentials.ts
function execFileAsync(cmd, args, options) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (error, stdout) => {
      if (error)
        reject(error);
      else
        resolve(String(stdout));
    });
  });
}
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
    const result = await execFileAsync("security", ["find-generic-password", "-s", "Claude Code-credentials", "-w"], { encoding: "utf-8", timeout: EXEC_TIMEOUT_MS });
    const creds = JSON.parse(result.trim());
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch (e) {
    debugError("keychain read", e);
    return await getCredentialsFromFile();
  }
}
async function getCredentialsFromFile() {
  try {
    const credPath = join(homedir(), ".claude", ".credentials.json");
    const fileStat = await stat(credPath);
    if ((fileStat.mode & 63) !== 0) {
      process.stderr.write(`[claude-ultimate-hud] WARNING: ${credPath} has insecure permissions (${(fileStat.mode & 511).toString(8)}). Expected 0600.
`);
    }
    const content = await readFile(credPath, "utf-8");
    const creds = JSON.parse(content);
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch (e) {
    debugError("credentials file", e);
    return null;
  }
}

// src/utils/api-client.ts
var CACHE_DIR = path2.join(os.homedir(), ".claude");
var CACHE_FILE = path2.join(CACHE_DIR, "claude-ultimate-hud-cache.json");
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
  let token = await getCredentials();
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
    token = null;
    clearTimeout(timeout);
    if (!response.ok)
      return null;
    const data = await response.json();
    const limits = {
      five_hour: data.five_hour,
      seven_day: data.seven_day,
      seven_day_sonnet: data.seven_day_sonnet
    };
    usageCache = { data: limits, timestamp: Date.now() };
    saveFileCache(limits);
    return limits;
  } catch (e) {
    token = null;
    debugError("API fetch", e);
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
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 448 });
    }
    const tmpFile = CACHE_FILE + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
    fs.writeFileSync(tmpFile, JSON.stringify({ data, timestamp: Date.now() }), { mode: 384 });
    fs.renameSync(tmpFile, CACHE_FILE);
  } catch (e) {
    debugError("cache write", e);
  }
}

// src/utils/config-counter.ts
import * as fs2 from "node:fs";
import * as path3 from "node:path";
import * as os2 from "node:os";
function readJsonFile(filePath) {
  if (!fs2.existsSync(filePath))
    return null;
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
  return new Set;
}
function getProjectScopedMcpServers(claudeJsonPath, cwd) {
  const config = readJsonFile(claudeJsonPath);
  if (!config?.projects || typeof config.projects !== "object")
    return new Set;
  const projects = config.projects;
  const projectConfig = projects[cwd];
  if (!projectConfig?.mcpServers || typeof projectConfig.mcpServers !== "object")
    return new Set;
  return new Set(Object.keys(projectConfig.mcpServers));
}
function isChromeExtensionMcpActive(claudeJsonPath) {
  const config = readJsonFile(claudeJsonPath);
  if (!config)
    return false;
  return config.claudeInChromeDefaultEnabled === true && config.cachedChromeExtensionInstalled === true;
}
function countHooksInFile(filePath) {
  const config = readJsonFile(filePath);
  if (config?.hooks && typeof config.hooks === "object") {
    return Object.keys(config.hooks).length;
  }
  return 0;
}
var MAX_RECURSION_DEPTH = 10;
function countRulesInDir(rulesDir, depth = 0, visited = new Set) {
  if (!fs2.existsSync(rulesDir))
    return 0;
  if (depth > MAX_RECURSION_DEPTH)
    return 0;
  let realPath;
  try {
    realPath = fs2.realpathSync(rulesDir);
    if (visited.has(realPath))
      return 0;
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
  } catch (e) {
    debugError("readdir rules", e);
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
  const countedPaths = new Set;
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
  hooksCount += countHooksInFile(userSettings);
  if (fs2.existsSync(userSettings)) {
    countedPaths.add(resolvePath(userSettings));
  }
  const userClaudeJson = path3.join(homeDir, ".claude.json");
  const allMcpServers = new Set;
  for (const name of getMcpServerNames(userSettings))
    allMcpServers.add(name);
  for (const name of getMcpServerNames(userClaudeJson))
    allMcpServers.add(name);
  if (cwd) {
    for (const name of getProjectScopedMcpServers(userClaudeJson, cwd))
      allMcpServers.add(name);
  }
  if (isChromeExtensionMcpActive(userClaudeJson)) {
    allMcpServers.add("claude-in-chrome");
  }
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
    if (countFileIfNew(path3.join(cwd, "CLAUDE.md")))
      claudeMdCount++;
    if (countFileIfNew(path3.join(cwd, "CLAUDE.local.md")))
      claudeMdCount++;
    if (countFileIfNew(path3.join(cwd, ".claude", "CLAUDE.md")))
      claudeMdCount++;
    if (countFileIfNew(path3.join(cwd, ".claude", "CLAUDE.local.md")))
      claudeMdCount++;
    const projectRulesDir = path3.join(cwd, ".claude", "rules");
    if (countFileIfNew(projectRulesDir)) {
      rulesCount += countRulesInDir(projectRulesDir);
    }
    const projectMcpJson = path3.join(cwd, ".mcp.json");
    if (fs2.existsSync(projectMcpJson)) {
      countFileIfNew(projectMcpJson);
      for (const name of getMcpServerNames(projectMcpJson))
        allMcpServers.add(name);
    }
    const projectSettings = path3.join(cwd, ".claude", "settings.json");
    if (countFileIfNew(projectSettings)) {
      for (const name of getMcpServerNames(projectSettings))
        allMcpServers.add(name);
      hooksCount += countHooksInFile(projectSettings);
    }
    const localSettings = path3.join(cwd, ".claude", "settings.local.json");
    if (countFileIfNew(localSettings)) {
      for (const name of getMcpServerNames(localSettings))
        allMcpServers.add(name);
      hooksCount += countHooksInFile(localSettings);
    }
  }
  mcpCount = allMcpServers.size;
  return { claudeMdCount, rulesCount, mcpCount, hooksCount };
}

// src/utils/transcript.ts
import * as fs3 from "node:fs";
import * as readline from "node:readline";
function isTranscriptLine(obj) {
  return typeof obj === "object" && obj !== null;
}
async function parseTranscript(transcriptPath) {
  const result = {
    tools: [],
    agents: [],
    todos: [],
    toolCallCount: 0,
    agentCallCount: 0,
    skillCallCount: 0
  };
  if (!transcriptPath || !fs3.existsSync(transcriptPath)) {
    return result;
  }
  const toolMap = new Map;
  const agentMap = new Map;
  let latestTodos = [];
  let totalLines = 0;
  let parseErrors = 0;
  try {
    const fileStream = fs3.createReadStream(transcriptPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      if (!line.trim())
        continue;
      totalLines++;
      try {
        const parsed = JSON.parse(line);
        if (isTranscriptLine(parsed)) {
          processEntry(parsed, toolMap, agentMap, latestTodos, result);
        } else {
          parseErrors++;
        }
      } catch (e) {
        parseErrors++;
        debugError("transcript parse", e);
      }
    }
  } catch (e) {
    debugError("transcript read", e);
  }
  if (totalLines > 0 && parseErrors / totalLines > 0.5) {
    process.stderr.write(`[claude-ultimate-hud] WARNING: ${parseErrors}/${totalLines} transcript lines failed to parse
`);
  }
  result.tools = Array.from(toolMap.values()).slice(-MAX_TRANSCRIPT_TOOLS);
  result.agents = Array.from(agentMap.values()).slice(-MAX_TRANSCRIPT_AGENTS);
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
    if (block.type === "thinking") {
      result.isThinking = true;
    }
    if (block.type === "text") {
      result.isThinking = false;
    }
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
        result.agentCallCount++;
      } else if (block.name === "Skill") {
        const input = block.input;
        const skillName = input?.skill ?? "unknown";
        result.lastSkill = { name: skillName, timestamp };
        result.skillCallCount++;
      } else if (block.name === "TodoWrite") {
        const input = block.input;
        if (input?.todos && Array.isArray(input.todos)) {
          latestTodos.length = 0;
          latestTodos.push(...input.todos);
        }
      } else {
        toolMap.set(block.id, toolEntry);
        result.toolCallCount++;
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
import { execFile as execFile2 } from "node:child_process";
import { existsSync as existsSync3, statSync } from "node:fs";
function execFileAsync2(cmd, args, options) {
  return new Promise((resolve2, reject) => {
    execFile2(cmd, args, options, (error, stdout) => {
      if (error)
        reject(error);
      else
        resolve2(String(stdout));
    });
  });
}
async function getGitBranch(cwd) {
  if (!cwd)
    return;
  try {
    if (!existsSync3(cwd) || !statSync(cwd).isDirectory()) {
      return;
    }
  } catch {
    return;
  }
  try {
    const result = await execFileAsync2("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      encoding: "utf-8",
      timeout: EXEC_TIMEOUT_MS
    });
    return result.trim() || undefined;
  } catch (e) {
    debugError("git branch", e);
    return;
  }
}

// src/utils/i18n.ts
import { execFile as execFile3 } from "node:child_process";
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
  },
  contextWarning: {
    warning: "Context {pct}% - consider /compact",
    critical: "Context {pct}% - /compact recommended!"
  }
};
var KO = {
  labels: {
    "5h": "5시간",
    "7d": "7일",
    "7d_all": "전체",
    "7d_sonnet": "소넷"
  },
  time: {
    hours: "시간",
    minutes: "분",
    shortHours: "시",
    shortMinutes: "분"
  },
  errors: {
    no_context: "컨텍스트 데이터 없음"
  },
  contextWarning: {
    warning: "컨텍스트 {pct}% - /compact 권장",
    critical: "컨텍스트 {pct}% - /compact 필요!"
  }
};
function getMacOSLocaleAsync() {
  if (process.platform !== "darwin")
    return Promise.resolve("");
  return new Promise((resolve2) => {
    execFile3("defaults", ["read", "-g", "AppleLocale"], { encoding: "utf-8", timeout: EXEC_TIMEOUT_MS }, (error, stdout) => {
      if (error)
        resolve2("");
      else
        resolve2(String(stdout).trim());
    });
  });
}
function isValidLangCode(lang) {
  if (!lang)
    return false;
  const lower = lang.toLowerCase();
  return !lower.startsWith("c.") && lower !== "c" && lower !== "posix";
}
async function detectLanguage() {
  const envLang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || "";
  if (isValidLangCode(envLang)) {
    if (envLang.toLowerCase().startsWith("ko"))
      return "ko";
    return "en";
  }
  const macLocale = await getMacOSLocaleAsync();
  if (macLocale.toLowerCase().startsWith("ko"))
    return "ko";
  return "en";
}
async function getTranslations(config) {
  const lang = config.language === "auto" ? await detectLanguage() : config.language;
  return lang === "ko" ? KO : EN;
}

// src/utils/omc-state.ts
import { existsSync as existsSync4, statSync as statSync2, readdirSync as readdirSync2, readFileSync as readFileSync2 } from "node:fs";
import { join as join3 } from "node:path";
var STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;
function readJsonFile2(filePath) {
  try {
    if (!existsSync4(filePath))
      return null;
    const stat2 = statSync2(filePath);
    if (!stat2.isFile() || Date.now() - stat2.mtimeMs > STALE_THRESHOLD_MS)
      return null;
    return JSON.parse(readFileSync2(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function findSessionStateDir(omcStateDir) {
  const sessionsDir = join3(omcStateDir, "sessions");
  try {
    if (!existsSync4(sessionsDir))
      return null;
    const entries = readdirSync2(sessionsDir, { withFileTypes: true });
    let latest = null;
    for (const entry of entries) {
      if (!entry.isDirectory())
        continue;
      try {
        const mtime = statSync2(join3(sessionsDir, entry.name)).mtimeMs;
        if (!latest || mtime > latest.mtime) {
          latest = { name: entry.name, mtime };
        }
      } catch {}
    }
    return latest ? join3(sessionsDir, latest.name) : null;
  } catch {
    return null;
  }
}
function readStateFile(cwd, filename) {
  const omcStateDir = join3(cwd, ".omc", "state");
  const sessionDir = findSessionStateDir(omcStateDir);
  if (sessionDir) {
    const data2 = readJsonFile2(join3(sessionDir, filename));
    if (data2)
      return data2;
  }
  const data = readJsonFile2(join3(omcStateDir, filename));
  if (data)
    return data;
  return readJsonFile2(join3(cwd, ".omc", filename));
}
async function readOmcState(cwd) {
  const state = {};
  if (!cwd)
    return state;
  if (!existsSync4(join3(cwd, ".omc")))
    return state;
  try {
    const ralph = readStateFile(cwd, "ralph-state.json");
    if (ralph?.active) {
      state.ralph = {
        active: true,
        iteration: ralph.iteration ?? 0,
        maxIterations: ralph.max_iterations ?? 0
      };
    }
    const ultrawork = readStateFile(cwd, "ultrawork-state.json");
    if (ultrawork?.active) {
      state.ultrawork = { active: true };
    }
    const autopilot = readStateFile(cwd, "autopilot-state.json");
    if (autopilot?.active) {
      state.autopilot = {
        active: true,
        phase: autopilot.current_phase ?? "",
        iteration: autopilot.iteration ?? 0,
        maxIterations: autopilot.max_iterations ?? 0
      };
    }
  } catch (e) {
    debugError("omc-state read", e);
  }
  return state;
}

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
  const rateParts = buildRateLimitsSection(ctx, t);
  if (rateParts) {
    parts.push(rateParts);
  }
  return parts.join(SEP);
}
function buildRateLimitsSection(ctx, t) {
  const limits = ctx.rateLimits;
  if (!limits)
    return colorize("\uD83D\uDD11 ?", COLORS.yellow);
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
      parts.push(`${t.labels["7d"]}: ${sevenDayParts.join(SEP)}`);
    }
  }
  return parts.length > 0 ? parts.join(SEP) : null;
}

// src/render/project-line.ts
import path4 from "node:path";
var SEP2 = ` ${COLORS.dim}│${RESET} `;
function renderProjectLine(ctx) {
  const parts = [];
  if (ctx.stdin.cwd) {
    const projectName = path4.basename(ctx.stdin.cwd) || ctx.stdin.cwd;
    let projectPart = `\uD83D\uDCC1 ${yellow(projectName)}`;
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
    parts.push(dim(`⏱️ ${ctx.sessionDuration}`));
  }
  return parts.join(SEP2);
}

// src/render/activity-lines.ts
function renderToolsLine(ctx) {
  const { tools } = ctx.transcript;
  if (tools.length === 0)
    return null;
  const parts = [];
  const runningTools = tools.filter((t) => t.status === "running");
  const completedTools = tools.filter((t) => t.status === "completed" || t.status === "error");
  for (const tool of runningTools.slice(-MAX_RUNNING_TOOLS)) {
    const target = tool.target ? truncatePath(tool.target) : "";
    parts.push(`${yellow("◐")} ${cyan(tool.name)}${target ? dim(`: ${target}`) : ""}`);
  }
  const toolCounts = new Map;
  for (const tool of completedTools) {
    const count = toolCounts.get(tool.name) ?? 0;
    toolCounts.set(tool.name, count + 1);
  }
  const sortedTools = Array.from(toolCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, MAX_COMPLETED_TOOL_TYPES);
  for (const [name, count] of sortedTools) {
    parts.push(`${green("✓")} ${name} ${dim(`×${count}`)}`);
  }
  return parts.length > 0 ? parts.join(" | ") : null;
}
function renderAgentsLine(ctx) {
  const { agents } = ctx.transcript;
  const runningAgents = agents.filter((a) => a.status === "running");
  const recentCompleted = agents.filter((a) => a.status === "completed").slice(-MAX_COMPLETED_AGENTS);
  const toShow = [...runningAgents, ...recentCompleted].slice(-MAX_AGENTS_DISPLAY);
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
  const desc = agent.description ? dim(`: ${truncate(agent.description, MAX_AGENT_DESC_LENGTH)}`) : "";
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
  const content = truncate(inProgress.content, MAX_TODO_CONTENT_LENGTH);
  const progress = dim(`(${completed}/${total})`);
  return `${yellow("▸")} ${content} ${progress}`;
}

// src/render/omc-line.ts
function renderOmcLine(ctx) {
  const parts = [];
  const omc = ctx.omcState;
  const t = ctx.transcript;
  if (omc.ralph?.active) {
    const iter = omc.ralph.maxIterations > 0 ? `${omc.ralph.iteration}/${omc.ralph.maxIterations}` : `${omc.ralph.iteration}`;
    parts.push(`${COLORS.cyan}\uD83D\uDD04 ralph:${iter}${RESET}`);
  }
  if (omc.autopilot?.active) {
    const phase = omc.autopilot.phase || "?";
    const iter = omc.autopilot.maxIterations > 0 ? `(${omc.autopilot.iteration}/${omc.autopilot.maxIterations})` : "";
    parts.push(`${COLORS.green}\uD83E\uDD16 autopilot:${phase}${iter}${RESET}`);
  }
  if (omc.ultrawork?.active) {
    parts.push(`${COLORS.yellow}⚡ ultrawork${RESET}`);
  }
  if (t.isThinking) {
    parts.push(`${COLORS.magenta}\uD83D\uDCAD thinking${RESET}`);
  }
  if (t.lastSkill) {
    parts.push(`${COLORS.cyan}\uD83C\uDFAF skill:${t.lastSkill.name}${RESET}`);
  }
  if (t.toolCallCount > 0 || t.agentCallCount > 0 || t.skillCallCount > 0) {
    const counts = [
      `T:${t.toolCallCount}`,
      `A:${t.agentCallCount}`,
      `S:${t.skillCallCount}`
    ].join(" ");
    parts.push(colorize(counts, COLORS.dim));
  }
  if (parts.length === 0)
    return "";
  return parts.join(` ${COLORS.dim}│${RESET} `);
}

// src/render/context-warning.ts
function renderContextWarning(ctx, t) {
  const usage = ctx.stdin.context_window.current_usage;
  if (!usage)
    return "";
  const baseTokens = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
  const totalTokens = ctx.stdin.context_window.context_window_size;
  if (totalTokens <= 0)
    return "";
  const currentTokens = baseTokens + AUTOCOMPACT_BUFFER;
  const percent = Math.min(100, Math.round(currentTokens / totalTokens * 100));
  if (percent >= 90) {
    const template = t.contextWarning?.critical ?? "Context {pct}% - /compact recommended!";
    return `${COLORS.red}\uD83D\uDD34 ${template.replace("{pct}", String(percent))}${RESET}`;
  }
  if (percent >= 80) {
    const template = t.contextWarning?.warning ?? "Context {pct}% - consider /compact";
    return `${COLORS.yellow}⚠️ ${template.replace("{pct}", String(percent))}${RESET}`;
  }
  return "";
}

// src/render/index.ts
function render(ctx, t) {
  const lines = [
    renderSessionLine(ctx, t),
    renderOmcLine(ctx),
    renderProjectLine(ctx),
    renderToolsLine(ctx),
    renderAgentsLine(ctx),
    renderTodosLine(ctx),
    renderContextWarning(ctx, t)
  ].filter(Boolean);
  for (const line of lines) {
    console.log(`${RESET}${line.replace(/ /g, " ")}`);
  }
}

// src/index.ts
var CONFIG_PATH = join4(homedir3(), ".claude", "claude-ultimate-hud.local.json");
function isValidDirectory(p) {
  if (!p || !isAbsolute(p))
    return false;
  try {
    return existsSync5(p) && statSync3(p).isDirectory();
  } catch {
    return false;
  }
}
function isValidTranscriptPath(p) {
  if (!p)
    return true;
  if (!isAbsolute(p))
    return false;
  const claudeDir = join4(homedir3(), ".claude");
  try {
    const resolved = resolve2(p);
    return (resolved === claudeDir || resolved.startsWith(claudeDir + sep)) && existsSync5(resolved);
  } catch {
    return false;
  }
}
async function readStdin() {
  try {
    const chunks = [];
    const stdinRead = (async () => {
      for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk));
      }
    })();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("stdin timeout")), STDIN_TIMEOUT_MS));
    await Promise.race([stdinRead, timeout]);
    const content = Buffer.concat(chunks).toString("utf-8");
    return JSON.parse(content);
  } catch (e) {
    debugError("stdin read", e);
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
  const [config, stdin] = await Promise.all([loadConfig(), readStdin()]);
  const t = await getTranslations(config);
  if (!stdin) {
    console.log(colorize("⚠️ stdin", COLORS.yellow));
    return;
  }
  const transcriptPath = stdin.transcript_path ?? "";
  const validTranscriptPath = isValidTranscriptPath(transcriptPath) ? transcriptPath : "";
  const validCwd = isValidDirectory(stdin.cwd ?? "") ? stdin.cwd : undefined;
  const [transcript, configCounts, gitBranch, rateLimits, omcState] = await Promise.all([
    parseTranscript(validTranscriptPath),
    countConfigs(validCwd),
    getGitBranch(validCwd),
    fetchUsageLimits(config.cache.ttlSeconds),
    readOmcState(validCwd)
  ]);
  const sessionDuration = formatSessionDuration(transcript.sessionStart);
  const ctx = {
    stdin,
    config,
    transcript,
    configCounts,
    gitBranch,
    sessionDuration,
    rateLimits,
    omcState
  };
  render(ctx, t);
}
main().catch((e) => {
  debugError("main", e);
  console.log(colorize("⚠️", COLORS.yellow));
});
