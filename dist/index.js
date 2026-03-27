#!/usr/bin/env node
// @bun

// src/index.ts
import { readFile as readFile2 } from "fs/promises";
import { join as join5, isAbsolute, resolve as resolve2, sep } from "path";
import { homedir as homedir5 } from "os";
import { existsSync as existsSync3, statSync as statSync3 } from "fs";

// src/types.ts
var DEFAULT_CONFIG = {
  language: "ko",
  plan: "max100",
  cache: {
    ttlSeconds: 300
  }
};

// src/constants.ts
var PROGRESS_BAR_WIDTH = 10;
var COLOR_THRESHOLD_WARNING = 50;
var COLOR_THRESHOLD_DANGER = 80;
var CONTEXT_HIGH_THRESHOLD = 85;
var MAX_RUNNING_TOOLS = 2;
var MAX_COMPLETED_TOOL_TYPES = 4;
var MAX_AGENTS_DISPLAY = 3;
var MAX_COMPLETED_AGENTS = 2;
var MAX_AGENT_DESC_LENGTH = 40;
var MAX_TODO_CONTENT_LENGTH = 50;
var MAX_TRANSCRIPT_TOOLS = 20;
var MAX_TRANSCRIPT_AGENTS = 10;
var STDIN_TIMEOUT_MS = 2000;
var EXEC_TIMEOUT_MS = 3000;
var API_TIMEOUT_MS = 5000;
var STALE_CACHE_MAX_AGE_S = 3600;
var NEGATIVE_CACHE_TTL_S = 30;
var LOCK_STALE_S = 30;
var LOCK_WAIT_MS = 2000;

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
  if (percent <= COLOR_THRESHOLD_WARNING)
    return COLORS.green;
  if (percent <= COLOR_THRESHOLD_DANGER)
    return COLORS.yellow;
  return COLORS.red;
}
function renderProgressBar(percent, width = PROGRESS_BAR_WIDTH) {
  const filled = Math.round(percent / 100 * width);
  const empty = width - filled;
  const color = getColorForPercent(percent);
  return `${color}${"\u2588".repeat(filled)}${COLORS.dim}${"\u2591".repeat(empty)}${RESET}`;
}

// src/utils/formatters.ts
import path from "path";
function formatTokens(n) {
  if (n >= 950000)
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
  return formatDurationMs(ms);
}
function formatSessionDurationMs(ms) {
  return formatDurationMs(ms);
}
function formatDurationMs(ms) {
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
var ANSI_REGEX = /\x1b\[[0-9;]*m/g;
function stripAnsi(str) {
  return str.replace(ANSI_REGEX, "");
}
function isWideChar(code) {
  return code >= 4352 && code <= 4447 || code >= 11904 && code <= 12350 || code >= 12352 && code <= 40959 || code >= 44032 && code <= 55215 || code >= 63744 && code <= 64255 || code >= 65040 && code <= 65135 || code >= 65281 && code <= 65376 || code >= 65504 && code <= 65510 || code >= 131072 && code <= 195103 || code >= 127744 && code <= 129535;
}
function visualWidth(str) {
  const plain = stripAnsi(str);
  let width = 0;
  for (const ch of plain) {
    const code = ch.codePointAt(0);
    width += isWideChar(code) ? 2 : 1;
  }
  return width;
}
var ANSI_STICKY = /\x1b\[[0-9;]*m/y;
function sliceVisible(str, maxWidth) {
  let visW = 0;
  let result = "";
  let i = 0;
  while (i < str.length) {
    ANSI_STICKY.lastIndex = i;
    const ansiMatch = ANSI_STICKY.exec(str);
    if (ansiMatch) {
      result += ansiMatch[0];
      i = ANSI_STICKY.lastIndex;
      continue;
    }
    const code = str.codePointAt(i);
    const charLen = code > 65535 ? 2 : 1;
    const charWidth = isWideChar(code) ? 2 : 1;
    if (visW + charWidth > maxWidth)
      break;
    result += str.slice(i, i + charLen);
    visW += charWidth;
    i += charLen;
  }
  return result + "\x1B[0m";
}

// src/utils/api-client.ts
import fs from "fs";
import os from "os";
import path2 from "path";
import crypto from "crypto";

// src/utils/credentials.ts
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

// src/utils/errors.ts
var IS_DEBUG = process.env.CLAUDE_HUD_DEBUG === "1";
function debugError(context, error) {
  if (!IS_DEBUG)
    return;
  const msg = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[HUD ERROR] ${context}: ${msg}
`);
}
function debugTrace(label, msg) {
  if (!IS_DEBUG)
    return;
  process.stderr.write(`[HUD TRACE] ${label}: ${msg}
`);
}

// src/utils/exec.ts
import { execFile } from "child_process";
function execFileAsync(cmd, args, options) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options ?? {}, (error, stdout) => {
      if (error)
        reject(error);
      else
        resolve(String(stdout));
    });
  });
}

// src/utils/credentials.ts
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
    debugTrace("cred", "keychain ok");
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch (e) {
    debugError("keychain read", e);
    debugTrace("cred", "file fallback");
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
      if (process.env.CLAUDE_HUD_STRICT_PERMS === "1")
        return null;
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
var NEGATIVE_CACHE_FILE = path2.join(CACHE_DIR, "claude-ultimate-hud-ncache.json");
var LOCK_FILE = path2.join(CACHE_DIR, "claude-ultimate-hud-usage.lock");
var ANTHROPIC_BETA_HEADER = "oauth-2025-04-20";
var API_HEADERS_BASE = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent": "claude-code/2.1",
  "anthropic-beta": ANTHROPIC_BETA_HEADER
};
async function fetchUsageLimits(ttlSeconds = 60) {
  if (isNegativeCached()) {
    debugTrace("api", "negative cache hit");
    return loadFileCache(STALE_CACHE_MAX_AGE_S);
  }
  const freshCache = loadFileCache(ttlSeconds);
  if (freshCache) {
    debugTrace("api", "file cache hit");
    return freshCache;
  }
  let lockFd = null;
  try {
    cleanStaleLock();
    lockFd = fs.openSync(LOCK_FILE, "wx");
  } catch {
    debugTrace("api", "lock contention, waiting");
    await waitForLock();
    const stale = loadFileCache(STALE_CACHE_MAX_AGE_S);
    if (stale) {
      debugTrace("api", "stale fallback after lock wait");
      return stale;
    }
    return null;
  }
  try {
    return await doFetch();
  } finally {
    releaseLock(lockFd);
  }
}
async function doFetch() {
  debugTrace("api", "cache expired, fetching");
  let token = await getCredentials();
  if (!token)
    return null;
  try {
    const controller = new AbortController;
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
      method: "GET",
      headers: { ...API_HEADERS_BASE, Authorization: `Bearer ${token}` },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("retry-after") ?? "", 10);
      if (retryAfter > 0 && retryAfter <= 10) {
        debugTrace("api", `429 retry after ${retryAfter}s`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        const retryController = new AbortController;
        const retryTimeout = setTimeout(() => retryController.abort(), API_TIMEOUT_MS);
        const retryResponse = await fetch("https://api.anthropic.com/api/oauth/usage", {
          method: "GET",
          headers: { ...API_HEADERS_BASE, Authorization: `Bearer ${token}` },
          signal: retryController.signal
        });
        clearTimeout(retryTimeout);
        token = null;
        if (retryResponse.ok) {
          const data2 = await retryResponse.json();
          const limits2 = extractLimits(data2);
          saveFileCache(limits2);
          clearNegativeCache();
          debugTrace("api", "429 retry ok");
          return limits2;
        }
      }
      token = null;
      debugTrace("api", "429 failed");
      saveNegativeCache();
      return loadFileCache(STALE_CACHE_MAX_AGE_S);
    }
    token = null;
    if (!response.ok) {
      saveNegativeCache();
      const stale = loadFileCache(STALE_CACHE_MAX_AGE_S);
      if (stale)
        debugTrace("api", "stale fallback");
      return stale;
    }
    const data = await response.json();
    const limits = extractLimits(data);
    saveFileCache(limits);
    clearNegativeCache();
    debugTrace("api", "fetch ok");
    return limits;
  } catch (e) {
    token = null;
    debugError("API fetch", e);
    saveNegativeCache();
    const stale = loadFileCache(STALE_CACHE_MAX_AGE_S);
    if (stale)
      debugTrace("api", "stale fallback on error");
    return stale;
  }
}
function extractLimits(data) {
  return {
    five_hour: data.five_hour,
    seven_day: data.seven_day,
    seven_day_sonnet: data.seven_day_sonnet
  };
}
function loadFileCache(maxAgeSeconds) {
  try {
    const content = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    const ageSeconds = (Date.now() - content.timestamp) / 1000;
    if (ageSeconds < maxAgeSeconds)
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
function isNegativeCached() {
  try {
    const content = JSON.parse(fs.readFileSync(NEGATIVE_CACHE_FILE, "utf-8"));
    return (Date.now() - content.timestamp) / 1000 < NEGATIVE_CACHE_TTL_S;
  } catch {
    return false;
  }
}
function saveNegativeCache() {
  try {
    const tmpFile = NEGATIVE_CACHE_FILE + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
    fs.writeFileSync(tmpFile, JSON.stringify({ timestamp: Date.now() }), { mode: 384 });
    fs.renameSync(tmpFile, NEGATIVE_CACHE_FILE);
  } catch (e) {
    debugError("negative cache write", e);
  }
}
function clearNegativeCache() {
  try {
    fs.unlinkSync(NEGATIVE_CACHE_FILE);
  } catch {}
}
function cleanStaleLock() {
  try {
    const stat2 = fs.statSync(LOCK_FILE);
    if (Date.now() - stat2.mtimeMs > LOCK_STALE_S * 1000) {
      fs.unlinkSync(LOCK_FILE);
      debugTrace("api", "removed stale lock");
    }
  } catch {}
}
async function waitForLock() {
  const start = Date.now();
  while (Date.now() - start < LOCK_WAIT_MS) {
    try {
      fs.statSync(LOCK_FILE);
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}
function releaseLock(fd) {
  if (fd !== null) {
    try {
      fs.closeSync(fd);
    } catch {}
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch {}
  }
}

// src/utils/config-counter.ts
import * as fs2 from "fs";
import * as path3 from "path";
import * as os2 from "os";
var CONFIG_CACHE_FILE = path3.join(os2.homedir(), ".claude", "claude-ultimate-hud-config-cache.json");
var CONFIG_CACHE_TTL_MS = 60000;
function loadConfigCache(cwd) {
  try {
    const raw = fs2.readFileSync(CONFIG_CACHE_FILE, "utf-8");
    const content = JSON.parse(raw);
    if (content.cwd !== cwd || Date.now() - content.timestamp > CONFIG_CACHE_TTL_MS)
      return null;
    return content.data;
  } catch {
    return null;
  }
}
function saveConfigCache(cwd, data) {
  try {
    fs2.writeFileSync(CONFIG_CACHE_FILE, JSON.stringify({ cwd, timestamp: Date.now(), data }), { mode: 384 });
  } catch {}
}
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
  if (cwd) {
    const cached = loadConfigCache(cwd);
    if (cached)
      return cached;
  }
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
  const result = { claudeMdCount, rulesCount, mcpCount, hooksCount };
  if (cwd)
    saveConfigCache(cwd, result);
  return result;
}

// src/utils/transcript.ts
import * as fs3 from "fs";
import * as readline from "readline";
import * as path4 from "path";
import * as os3 from "os";
var TRANSCRIPT_CACHE_FILE = path4.join(os3.homedir(), ".claude", "claude-ultimate-hud-transcript-cache.json");
function isTranscriptLine(obj) {
  return typeof obj === "object" && obj !== null;
}
function serializeToolEntry(entry) {
  return {
    name: entry.name,
    target: entry.target,
    status: entry.status,
    startTime: entry.startTime.toISOString(),
    endTime: entry.endTime?.toISOString()
  };
}
function deserializeToolEntry(entry) {
  return {
    name: entry.name,
    target: entry.target,
    status: entry.status,
    startTime: new Date(entry.startTime),
    endTime: entry.endTime ? new Date(entry.endTime) : undefined
  };
}
function serializeAgentEntry(entry) {
  return {
    type: entry.type,
    model: entry.model,
    description: entry.description,
    status: entry.status,
    startTime: entry.startTime.toISOString(),
    endTime: entry.endTime?.toISOString()
  };
}
function deserializeAgentEntry(entry) {
  return {
    type: entry.type,
    model: entry.model,
    description: entry.description,
    status: entry.status,
    startTime: new Date(entry.startTime),
    endTime: entry.endTime ? new Date(entry.endTime) : undefined
  };
}
function loadTranscriptCache(filePath, currentFileSize) {
  try {
    const content = JSON.parse(fs3.readFileSync(TRANSCRIPT_CACHE_FILE, "utf-8"));
    if (content.filePath === filePath && content.fileSize <= currentFileSize) {
      return content;
    }
    return null;
  } catch {
    return null;
  }
}
function saveTranscriptCache(filePath, fileSize, toolMap, agentMap, todos, result) {
  try {
    const toolEntries = Array.from(toolMap.entries()).slice(-(MAX_TRANSCRIPT_TOOLS * 2));
    const agentEntries = Array.from(agentMap.entries()).slice(-(MAX_TRANSCRIPT_AGENTS * 2));
    const cache = {
      filePath,
      fileSize,
      data: {
        toolCallCount: result.toolCallCount,
        agentCallCount: result.agentCallCount,
        skillCallCount: result.skillCallCount,
        sessionStart: result.sessionStart?.toISOString(),
        isThinking: result.isThinking,
        lastSkill: result.lastSkill ? { name: result.lastSkill.name, timestamp: result.lastSkill.timestamp.toISOString() } : undefined,
        tools: toolEntries.map(([id, entry]) => [id, serializeToolEntry(entry)]),
        agents: agentEntries.map(([id, entry]) => [id, serializeAgentEntry(entry)]),
        todos
      }
    };
    fs3.writeFileSync(TRANSCRIPT_CACHE_FILE, JSON.stringify(cache), { mode: 384 });
  } catch (e) {
    debugError("transcript cache write", e);
  }
}
function normalizeStatus(status) {
  switch (status) {
    case "not_started":
    case "pending":
      return "pending";
    case "running":
    case "in_progress":
      return "in_progress";
    case "done":
    case "complete":
    case "completed":
      return "completed";
    default:
      return "pending";
  }
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
  const fileStat = fs3.statSync(transcriptPath);
  const fileSize = fileStat.size;
  const cache = loadTranscriptCache(transcriptPath, fileSize);
  const toolMap = new Map;
  const agentMap = new Map;
  let latestTodos = [];
  let startOffset = 0;
  if (cache) {
    result.toolCallCount = cache.data.toolCallCount;
    result.agentCallCount = cache.data.agentCallCount;
    result.skillCallCount = cache.data.skillCallCount;
    result.sessionStart = cache.data.sessionStart ? new Date(cache.data.sessionStart) : undefined;
    result.isThinking = cache.data.isThinking;
    if (cache.data.lastSkill) {
      result.lastSkill = {
        name: cache.data.lastSkill.name,
        timestamp: new Date(cache.data.lastSkill.timestamp)
      };
    }
    for (const [id, entry] of cache.data.tools) {
      toolMap.set(id, deserializeToolEntry(entry));
    }
    for (const [id, entry] of cache.data.agents) {
      agentMap.set(id, deserializeAgentEntry(entry));
    }
    latestTodos = cache.data.todos;
    startOffset = cache.fileSize;
    if (fileSize === cache.fileSize) {
      result.tools = Array.from(toolMap.values()).slice(-MAX_TRANSCRIPT_TOOLS);
      result.agents = Array.from(agentMap.values()).slice(-MAX_TRANSCRIPT_AGENTS);
      result.todos = latestTodos;
      return result;
    }
  }
  try {
    const fileStream = fs3.createReadStream(transcriptPath, { start: startOffset });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      if (!line.trim())
        continue;
      try {
        const parsed = JSON.parse(line);
        if (isTranscriptLine(parsed)) {
          processEntry(parsed, toolMap, agentMap, latestTodos, result);
        }
      } catch {}
    }
  } catch (e) {
    debugError("transcript read", e);
  }
  result.tools = Array.from(toolMap.values()).slice(-MAX_TRANSCRIPT_TOOLS);
  result.agents = Array.from(agentMap.values()).slice(-MAX_TRANSCRIPT_AGENTS);
  result.todos = latestTodos;
  saveTranscriptCache(transcriptPath, fileSize, toolMap, agentMap, latestTodos, result);
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
      if (block.name === "Task" || block.name === "Agent") {
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
      } else if (block.name === "TaskCreate") {
        const input = block.input;
        if (input?.id && input?.content) {
          const todo = {
            id: input.id,
            content: input.content,
            status: normalizeStatus(input.status)
          };
          const existingIdx = latestTodos.findIndex((t) => t.id === input.id);
          if (existingIdx >= 0) {
            latestTodos[existingIdx] = todo;
          } else {
            latestTodos.push(todo);
          }
        }
      } else if (block.name === "TaskUpdate") {
        const input = block.input;
        if (input?.id) {
          const existing = latestTodos.find((t) => t.id === input.id);
          if (existing && input.status) {
            existing.status = normalizeStatus(input.status);
          }
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
      return cmd ? truncate(cmd, 33) : undefined;
    }
  }
  return;
}

// src/utils/git.ts
import { statSync as statSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "fs";
import { join as join4 } from "path";
import { homedir as homedir4 } from "os";
var GIT_CACHE_FILE = join4(homedir4(), ".claude", "claude-ultimate-hud-git-cache.json");
var GIT_CACHE_TTL_MS = 120000;
function loadGitCache(cwd) {
  try {
    const raw = readFileSync3(GIT_CACHE_FILE, "utf-8");
    const content = JSON.parse(raw);
    if (content.cwd !== cwd || Date.now() - content.timestamp > GIT_CACHE_TTL_MS)
      return null;
    return content.info;
  } catch {
    return null;
  }
}
function saveGitCache(cwd, info) {
  try {
    writeFileSync3(GIT_CACHE_FILE, JSON.stringify({ cwd, timestamp: Date.now(), info }), { mode: 384 });
  } catch {}
}
async function getGitInfo(cwd) {
  if (!cwd)
    return;
  const cached = loadGitCache(cwd);
  if (cached)
    return cached;
  try {
    if (!statSync2(cwd).isDirectory())
      return;
  } catch {
    return;
  }
  try {
    const execOpts = { cwd, encoding: "utf-8", timeout: EXEC_TIMEOUT_MS };
    const [branchResult, statusResult, upstreamResult] = await Promise.all([
      execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], execOpts),
      execFileAsync("git", ["--no-optional-locks", "status", "--porcelain"], execOpts).catch(() => ""),
      execFileAsync("git", ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"], execOpts).catch(() => "")
    ]);
    const branch = branchResult.trim();
    if (!branch)
      return;
    const dirty = statusResult.trim().length > 0;
    let ahead = 0;
    let behind = 0;
    const parts = upstreamResult.trim().split(/\s+/);
    if (parts.length === 2) {
      behind = parseInt(parts[0], 10) || 0;
      ahead = parseInt(parts[1], 10) || 0;
    }
    const info = { branch, dirty, ahead, behind };
    saveGitCache(cwd, info);
    return info;
  } catch (e) {
    debugError("git info", e);
    return;
  }
}

// src/utils/i18n.ts
var EN = {
  labels: {
    "5h": "5h",
    "7d": "7d",
    "7d_all": "all",
    "7d_sonnet": "Sonnet",
    cost: "Cost"
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
  },
  todos: {
    allComplete: "All todos complete"
  },
  stats: {
    thinking: "thinking"
  }
};
var KO = {
  labels: {
    "5h": "5\uC2DC\uAC04",
    "7d": "7\uC77C",
    "7d_all": "\uC804\uCCB4",
    "7d_sonnet": "\uC18C\uB137",
    cost: "\uBE44\uC6A9"
  },
  time: {
    hours: "\uC2DC\uAC04",
    minutes: "\uBD84",
    shortHours: "\uC2DC",
    shortMinutes: "\uBD84"
  },
  errors: {
    no_context: "\uCEE8\uD14D\uC2A4\uD2B8 \uB370\uC774\uD130 \uC5C6\uC74C"
  },
  contextWarning: {
    warning: "\uCEE8\uD14D\uC2A4\uD2B8 {pct}% - /compact \uAD8C\uC7A5",
    critical: "\uCEE8\uD14D\uC2A4\uD2B8 {pct}% - /compact \uD544\uC694!"
  },
  todos: {
    allComplete: "\uBAA8\uB4E0 \uD560 \uC77C \uC644\uB8CC"
  },
  stats: {
    thinking: "\uC0AC\uACE0 \uC911"
  }
};
function getMacOSLocaleAsync() {
  if (process.platform !== "darwin")
    return Promise.resolve("");
  return execFileAsync("defaults", ["read", "-g", "AppleLocale"], { encoding: "utf-8", timeout: EXEC_TIMEOUT_MS }).then((s) => s.trim()).catch(() => "");
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

// src/render/session-line.ts
var SEP = ` ${COLORS.dim}\u2502${RESET} `;
function renderSessionLine(ctx, t) {
  const parts = [];
  const modelName = shortenModelName(ctx.stdin.model.display_name);
  parts.push(`${COLORS.cyan}\uD83E\uDD16 ${modelName}${RESET}`);
  const usage = ctx.stdin.context_window.current_usage;
  const nativePercent = ctx.stdin.used_percentage;
  if (!usage && nativePercent == null) {
    parts.push(colorize(t.errors.no_context, COLORS.dim));
    return parts.join(SEP);
  }
  const currentTokens = usage ? usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens : 0;
  const totalTokens = ctx.stdin.context_window.context_window_size;
  const percent = nativePercent != null ? Math.min(100, Math.round(nativePercent)) : Math.min(100, Math.round(currentTokens / totalTokens * 100));
  parts.push(renderProgressBar(percent));
  const percentColor = getColorForPercent(percent);
  parts.push(colorize(`${percent}%`, percentColor));
  parts.push(`${formatTokens(currentTokens)}/${formatTokens(totalTokens)}`);
  if (percent >= CONTEXT_HIGH_THRESHOLD && usage && ctx.config.display?.showTokenBreakdown !== false) {
    const inTokens = formatTokens(usage.input_tokens);
    const cacheTokens = formatTokens(usage.cache_creation_input_tokens + usage.cache_read_input_tokens);
    parts.push(dim(`(in: ${inTokens}, cache: ${cacheTokens})`));
  }
  const rateParts = buildRateLimitsSection(ctx, t);
  if (rateParts) {
    parts.push(rateParts);
  }
  return parts.join(SEP);
}
function formatCostUsd(cost) {
  if (cost >= 100)
    return `$${Math.round(cost)}`;
  if (cost >= 10)
    return `$${cost.toFixed(1)}`;
  return `$${cost.toFixed(2)}`;
}
function buildRateLimitsSection(ctx, t) {
  const limits = ctx.rateLimits;
  const isEnterprise = ctx.config.plan === "enterprise";
  if (isEnterprise) {
    const parts2 = [];
    const cost = ctx.stdin.cost.total_cost_usd;
    parts2.push(`${t.labels.cost}: ${colorize(`\uD83D\uDCB0 ${formatCostUsd(cost)}`, COLORS.cyan)}`);
    if (limits?.five_hour) {
      const pct = Math.round(limits.five_hour.utilization);
      const color = getColorForPercent(pct);
      let text = `${t.labels["5h"]}: ${colorize(`${pct}%`, color)}`;
      if (limits.five_hour.resets_at) {
        const remaining = formatTimeRemaining(limits.five_hour.resets_at, t);
        text += ` (${remaining})`;
      }
      parts2.push(text);
    }
    return parts2.length > 0 ? parts2.join(SEP) : null;
  }
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
import path5 from "path";
var SEP2 = ` ${COLORS.dim}\u2502${RESET} `;
function renderProjectLine(ctx) {
  const parts = [];
  if (ctx.stdin.cwd) {
    const projectName = path5.basename(ctx.stdin.cwd) || ctx.stdin.cwd;
    let projectPart = `\uD83D\uDCC1 ${yellow(projectName)}`;
    if (ctx.gitInfo) {
      let gitStr = ctx.gitInfo.branch;
      if (ctx.gitInfo.dirty)
        gitStr += "*";
      const modifiers = [];
      if (ctx.gitInfo.ahead > 0)
        modifiers.push(`\u2191${ctx.gitInfo.ahead}`);
      if (ctx.gitInfo.behind > 0)
        modifiers.push(`\u2193${ctx.gitInfo.behind}`);
      if (modifiers.length > 0)
        gitStr += ` ${modifiers.join(" ")}`;
      projectPart += ` ${magenta("git:(")}${cyan(gitStr)}${magenta(")")}`;
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
  if (tools.length === 0)
    return null;
  const parts = [];
  const runningTools = tools.filter((t) => t.status === "running");
  const completedTools = tools.filter((t) => t.status === "completed" || t.status === "error");
  for (const tool of runningTools.slice(-MAX_RUNNING_TOOLS)) {
    const target = tool.target ? truncatePath(tool.target) : "";
    parts.push(`${yellow("\u25D0")} ${cyan(tool.name)}${target ? dim(`: ${target}`) : ""}`);
  }
  const toolCounts = new Map;
  for (const tool of completedTools) {
    const count = toolCounts.get(tool.name) ?? 0;
    toolCounts.set(tool.name, count + 1);
  }
  const sortedTools = Array.from(toolCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, MAX_COMPLETED_TOOL_TYPES);
  for (const [name, count] of sortedTools) {
    parts.push(`${green("\u2713")} ${name} ${dim(`\xD7${count}`)}`);
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
  const statusIcon = agent.status === "running" ? yellow("\u25D0") : green("\u2713");
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
function renderTodosLine(ctx, t) {
  const { todos } = ctx.transcript;
  if (!todos || todos.length === 0)
    return null;
  const inProgress = todos.find((td) => td.status === "in_progress");
  const completed = todos.filter((td) => td.status === "completed").length;
  const total = todos.length;
  if (!inProgress) {
    if (completed === total && total > 0) {
      return `${green("\u2713")} ${t.todos.allComplete} ${dim(`(${completed}/${total})`)}`;
    }
    return null;
  }
  const content = truncate(inProgress.content, MAX_TODO_CONTENT_LENGTH);
  const progress = dim(`(${completed}/${total})`);
  return `${yellow("\u25B8")} ${content} ${progress}`;
}

// src/render/stats-line.ts
function renderStatsLine(ctx, t) {
  const parts = [];
  const tr = ctx.transcript;
  if (tr.isThinking) {
    parts.push(`${COLORS.magenta}\uD83D\uDCAD ${t.stats.thinking}${RESET}`);
  }
  if (tr.lastSkill) {
    parts.push(`${COLORS.cyan}\uD83C\uDFAF skill:${tr.lastSkill.name}${RESET}`);
  }
  const added = ctx.stdin.total_lines_added;
  const removed = ctx.stdin.total_lines_removed;
  if (added != null || removed != null) {
    const linesParts = [];
    if (added != null && added > 0)
      linesParts.push(`+${added}`);
    if (removed != null && removed > 0)
      linesParts.push(`-${removed}`);
    if (linesParts.length > 0) {
      parts.push(colorize(linesParts.join(" "), COLORS.dim));
    }
  }
  if (parts.length === 0)
    return "";
  return parts.join(` ${COLORS.dim}\u2502${RESET} `);
}

// src/render/context-warning.ts
function renderContextWarning(ctx, t) {
  const usage = ctx.stdin.context_window.current_usage;
  const nativePercent = ctx.stdin.used_percentage;
  if (!usage && nativePercent == null)
    return "";
  let percent;
  if (nativePercent != null) {
    percent = Math.min(100, Math.round(nativePercent));
  } else {
    const currentTokens = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
    const totalTokens = ctx.stdin.context_window.context_window_size;
    if (totalTokens <= 0)
      return "";
    percent = Math.min(100, Math.round(currentTokens / totalTokens * 100));
  }
  if (percent >= 90) {
    const template = t.contextWarning?.critical ?? "Context {pct}% - /compact recommended!";
    return `${COLORS.red}\uD83D\uDD34 ${template.replace("{pct}", String(percent))}${RESET}`;
  }
  if (percent >= 80) {
    const template = t.contextWarning?.warning ?? "Context {pct}% - consider /compact";
    return `${COLORS.yellow}\u26A0\uFE0F ${template.replace("{pct}", String(percent))}${RESET}`;
  }
  return "";
}

// src/render/index.ts
function render(ctx, t) {
  const display = ctx.config.display ?? {};
  const termWidth = process.stdout.columns || 120;
  const lines = [
    renderSessionLine(ctx, t),
    display.showStats !== false ? renderStatsLine(ctx, t) : "",
    renderProjectLine(ctx),
    display.showTools !== false ? renderToolsLine(ctx) : null,
    display.showAgents !== false ? renderAgentsLine(ctx) : null,
    display.showTodos !== false ? renderTodosLine(ctx, t) : null,
    renderContextWarning(ctx, t)
  ].filter(Boolean);
  const output = [];
  for (const line of lines) {
    let outputLine = `${RESET}${line.replace(/ /g, "\xA0")}`;
    const plain = stripAnsi(outputLine);
    if (plain.length > termWidth / 2 && visualWidth(outputLine) > termWidth) {
      outputLine = sliceVisible(outputLine, termWidth);
    }
    output.push(outputLine);
  }
  process.stdout.write(output.join(`
`) + `
`);
}

// src/index.ts
var CONFIG_PATH = join5(homedir5(), ".claude", "claude-ultimate-hud.local.json");
function isValidDirectory(p) {
  if (!p || !isAbsolute(p))
    return false;
  try {
    return existsSync3(p) && statSync3(p).isDirectory();
  } catch {
    return false;
  }
}
function isValidTranscriptPath(p) {
  if (!p)
    return true;
  if (!isAbsolute(p))
    return false;
  const claudeDir = join5(homedir5(), ".claude");
  try {
    const resolved = resolve2(p);
    return (resolved === claudeDir || resolved.startsWith(claudeDir + sep)) && existsSync3(resolved);
  } catch {
    return false;
  }
}
async function readStdin() {
  let timerId;
  try {
    const stdinRead = typeof Bun !== "undefined" ? Bun.stdin.text() : (async () => {
      const chunks = [];
      for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString("utf-8");
    })();
    const timeout = new Promise((_, reject) => {
      timerId = setTimeout(() => reject(new Error("stdin timeout")), STDIN_TIMEOUT_MS);
    });
    const content = await Promise.race([stdinRead, timeout]);
    clearTimeout(timerId);
    return JSON.parse(content);
  } catch (e) {
    clearTimeout(timerId);
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
  if (!stdin) {
    console.log(colorize("\u26A0\uFE0F stdin", COLORS.yellow));
    return;
  }
  if (!stdin.model || typeof stdin.model.display_name !== "string" || !stdin.context_window || typeof stdin.context_window.context_window_size !== "number" || !stdin.cost) {
    console.log(colorize("\u26A0\uFE0F stdin: missing fields", COLORS.yellow));
    return;
  }
  const transcriptPath = stdin.transcript_path ?? "";
  const validTranscriptPath = isValidTranscriptPath(transcriptPath) ? transcriptPath : "";
  const validCwd = isValidDirectory(stdin.cwd ?? "") ? stdin.cwd : undefined;
  const t = await getTranslations(config);
  const [transcript, configCounts, gitInfo, rateLimits] = await Promise.all([
    parseTranscript(validTranscriptPath),
    countConfigs(validCwd),
    getGitInfo(validCwd),
    fetchUsageLimits(config.cache.ttlSeconds)
  ]);
  const sessionDuration = stdin.total_duration_ms != null ? formatSessionDurationMs(stdin.total_duration_ms) : formatSessionDuration(transcript.sessionStart);
  const ctx = {
    stdin,
    config,
    transcript,
    configCounts,
    gitInfo,
    sessionDuration,
    rateLimits
  };
  render(ctx, t);
}
main().catch((e) => {
  debugError("main", e);
  console.log(colorize("\u26A0\uFE0F", COLORS.yellow));
});
