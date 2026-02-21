import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ConfigCounts } from '../types.js';
import { debugError } from './errors.js';

const CONFIG_CACHE_FILE = path.join(os.homedir(), '.claude', 'claude-ultimate-hud-config-cache.json');
const CONFIG_CACHE_TTL_MS = 60_000;

function loadConfigCache(cwd: string): ConfigCounts | null {
  try {
    if (!fs.existsSync(CONFIG_CACHE_FILE)) return null;
    const raw = fs.readFileSync(CONFIG_CACHE_FILE, 'utf-8');
    const content = JSON.parse(raw) as { cwd: string; timestamp: number; data: ConfigCounts };
    if (content.cwd !== cwd || Date.now() - content.timestamp > CONFIG_CACHE_TTL_MS) return null;
    return content.data;
  } catch {
    return null;
  }
}

function saveConfigCache(cwd: string, data: ConfigCounts): void {
  try {
    fs.writeFileSync(CONFIG_CACHE_FILE, JSON.stringify({ cwd, timestamp: Date.now(), data }), { mode: 0o600 });
  } catch { /* ignore */ }
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getMcpServerNames(filePath: string): Set<string> {
  const config = readJsonFile(filePath);
  if (config?.mcpServers && typeof config.mcpServers === 'object') {
    return new Set(Object.keys(config.mcpServers));
  }
  return new Set();
}

function getProjectScopedMcpServers(claudeJsonPath: string, cwd: string): Set<string> {
  const config = readJsonFile(claudeJsonPath);
  if (!config?.projects || typeof config.projects !== 'object') return new Set();
  const projects = config.projects as Record<string, Record<string, unknown>>;
  const projectConfig = projects[cwd];
  if (!projectConfig?.mcpServers || typeof projectConfig.mcpServers !== 'object') return new Set();
  return new Set(Object.keys(projectConfig.mcpServers as Record<string, unknown>));
}

function isChromeExtensionMcpActive(claudeJsonPath: string): boolean {
  const config = readJsonFile(claudeJsonPath);
  if (!config) return false;
  return config.claudeInChromeDefaultEnabled === true &&
    config.cachedChromeExtensionInstalled === true;
}

function countHooksInFile(filePath: string): number {
  const config = readJsonFile(filePath);
  if (config?.hooks && typeof config.hooks === 'object') {
    return Object.keys(config.hooks).length;
  }
  return 0;
}

const MAX_RECURSION_DEPTH = 10;

function countRulesInDir(rulesDir: string, depth = 0, visited = new Set<string>()): number {
  if (!fs.existsSync(rulesDir)) return 0;
  if (depth > MAX_RECURSION_DEPTH) return 0;

  // Resolve real path to prevent symlink loops
  let realPath: string;
  try {
    realPath = fs.realpathSync(rulesDir);
    if (visited.has(realPath)) return 0;
    visited.add(realPath);
  } catch {
    return 0;
  }

  let count = 0;
  try {
    const entries = fs.readdirSync(rulesDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(rulesDir, entry.name);
      if (entry.isDirectory()) {
        count += countRulesInDir(fullPath, depth + 1, visited);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        count++;
      }
    }
  } catch (e) {
    debugError('readdir rules', e);
  }
  return count;
}

function resolvePath(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

export async function countConfigs(cwd?: string): Promise<ConfigCounts> {
  if (cwd) {
    const cached = loadConfigCache(cwd);
    if (cached) return cached;
  }

  let claudeMdCount = 0;
  let rulesCount = 0;
  let mcpCount = 0;
  let hooksCount = 0;

  const homeDir = os.homedir();
  const claudeDir = path.join(homeDir, '.claude');

  // Track already counted paths to prevent duplicates
  const countedPaths = new Set<string>();

  const userClaudeMd = path.join(claudeDir, 'CLAUDE.md');
  if (fs.existsSync(userClaudeMd)) {
    claudeMdCount++;
    countedPaths.add(resolvePath(userClaudeMd));
  }

  const userRulesDir = path.join(claudeDir, 'rules');
  rulesCount += countRulesInDir(userRulesDir);
  if (fs.existsSync(userRulesDir)) {
    countedPaths.add(resolvePath(userRulesDir));
  }

  const userSettings = path.join(claudeDir, 'settings.json');
  hooksCount += countHooksInFile(userSettings);
  if (fs.existsSync(userSettings)) {
    countedPaths.add(resolvePath(userSettings));
  }

  const userClaudeJson = path.join(homeDir, '.claude.json');

  // Collect all unique MCP server names using a Set for deduplication
  const allMcpServers = new Set<string>();

  // 1. From ~/.claude/settings.json (top-level mcpServers)
  for (const name of getMcpServerNames(userSettings)) allMcpServers.add(name);

  // 2. From ~/.claude.json (top-level mcpServers)
  for (const name of getMcpServerNames(userClaudeJson)) allMcpServers.add(name);

  // 3. From ~/.claude.json (project-scoped mcpServers)
  if (cwd) {
    for (const name of getProjectScopedMcpServers(userClaudeJson, cwd)) allMcpServers.add(name);
  }

  // 4. Chrome extension MCP (dynamically injected, not in config files)
  if (isChromeExtensionMcpActive(userClaudeJson)) {
    allMcpServers.add('claude-in-chrome');
  }

  if (cwd) {
    // Helper to check and count file if not already counted
    const countFileIfNew = (filePath: string): boolean => {
      if (!fs.existsSync(filePath)) return false;
      const resolved = resolvePath(filePath);
      if (countedPaths.has(resolved)) return false;
      countedPaths.add(resolved);
      return true;
    };

    if (countFileIfNew(path.join(cwd, 'CLAUDE.md'))) claudeMdCount++;
    if (countFileIfNew(path.join(cwd, 'CLAUDE.local.md'))) claudeMdCount++;
    if (countFileIfNew(path.join(cwd, '.claude', 'CLAUDE.md'))) claudeMdCount++;
    if (countFileIfNew(path.join(cwd, '.claude', 'CLAUDE.local.md'))) claudeMdCount++;

    const projectRulesDir = path.join(cwd, '.claude', 'rules');
    if (countFileIfNew(projectRulesDir)) {
      rulesCount += countRulesInDir(projectRulesDir);
    }

    // 5. From {cwd}/.mcp.json
    const projectMcpJson = path.join(cwd, '.mcp.json');
    if (fs.existsSync(projectMcpJson)) {
      countFileIfNew(projectMcpJson);
      for (const name of getMcpServerNames(projectMcpJson)) allMcpServers.add(name);
    }

    // 6. From {cwd}/.claude/settings.json
    const projectSettings = path.join(cwd, '.claude', 'settings.json');
    if (countFileIfNew(projectSettings)) {
      for (const name of getMcpServerNames(projectSettings)) allMcpServers.add(name);
      hooksCount += countHooksInFile(projectSettings);
    }

    // 7. From {cwd}/.claude/settings.local.json
    const localSettings = path.join(cwd, '.claude', 'settings.local.json');
    if (countFileIfNew(localSettings)) {
      for (const name of getMcpServerNames(localSettings)) allMcpServers.add(name);
      hooksCount += countHooksInFile(localSettings);
    }
  }

  mcpCount = allMcpServers.size;

  const result = { claudeMdCount, rulesCount, mcpCount, hooksCount };
  if (cwd) saveConfigCache(cwd, result);
  return result;
}
