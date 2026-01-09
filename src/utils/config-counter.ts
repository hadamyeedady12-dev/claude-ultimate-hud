import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ConfigCounts } from '../types.js';

function getMcpServerNames(filePath: string): Set<string> {
  if (!fs.existsSync(filePath)) return new Set();
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    if (config.mcpServers && typeof config.mcpServers === 'object') {
      return new Set(Object.keys(config.mcpServers));
    }
  } catch {}
  return new Set();
}

function countMcpServersInFile(filePath: string, excludeFrom?: string): number {
  const servers = getMcpServerNames(filePath);
  if (excludeFrom) {
    const exclude = getMcpServerNames(excludeFrom);
    for (const name of exclude) servers.delete(name);
  }
  return servers.size;
}

function countHooksInFile(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    if (config.hooks && typeof config.hooks === 'object') {
      return Object.keys(config.hooks).length;
    }
  } catch {}
  return 0;
}

function countRulesInDir(rulesDir: string): number {
  if (!fs.existsSync(rulesDir)) return 0;
  let count = 0;
  try {
    const entries = fs.readdirSync(rulesDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(rulesDir, entry.name);
      if (entry.isDirectory()) {
        count += countRulesInDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        count++;
      }
    }
  } catch {}
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
  mcpCount += countMcpServersInFile(userSettings);
  hooksCount += countHooksInFile(userSettings);
  if (fs.existsSync(userSettings)) {
    countedPaths.add(resolvePath(userSettings));
  }

  const userClaudeJson = path.join(homeDir, '.claude.json');
  mcpCount += countMcpServersInFile(userClaudeJson, userSettings);

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

    const projectMcpJson = path.join(cwd, '.mcp.json');
    if (countFileIfNew(projectMcpJson)) {
      mcpCount += countMcpServersInFile(projectMcpJson);
    }

    const projectSettings = path.join(cwd, '.claude', 'settings.json');
    if (countFileIfNew(projectSettings)) {
      mcpCount += countMcpServersInFile(projectSettings);
      hooksCount += countHooksInFile(projectSettings);
    }

    const localSettings = path.join(cwd, '.claude', 'settings.local.json');
    if (countFileIfNew(localSettings)) {
      mcpCount += countMcpServersInFile(localSettings);
      hooksCount += countHooksInFile(localSettings);
    }
  }

  return { claudeMdCount, rulesCount, mcpCount, hooksCount };
}
