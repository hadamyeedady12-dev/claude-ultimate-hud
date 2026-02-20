import * as fs from 'node:fs';
import * as readline from 'node:readline';
import * as path from 'node:path';
import * as os from 'node:os';
import type { TranscriptData, ToolEntry, AgentEntry, TodoEntry } from '../types.js';
import { debugError } from './errors.js';
import { MAX_TRANSCRIPT_TOOLS, MAX_TRANSCRIPT_AGENTS } from '../constants.js';

const TRANSCRIPT_CACHE_FILE = path.join(os.homedir(), '.claude', 'claude-ultimate-hud-transcript-cache.json');

// --- Serializable cache types ---

interface SerializedToolEntry {
  name: string;
  target?: string;
  status: 'running' | 'completed' | 'error';
  startTime: string;
  endTime?: string;
}

interface SerializedAgentEntry {
  type: string;
  model?: string;
  description?: string;
  status: 'running' | 'completed';
  startTime: string;
  endTime?: string;
}

interface TranscriptCache {
  filePath: string;
  fileSize: number;
  data: {
    toolCallCount: number;
    agentCallCount: number;
    skillCallCount: number;
    sessionStart?: string;
    isThinking?: boolean;
    lastSkill?: { name: string; timestamp: string };
    tools: [string, SerializedToolEntry][];
    agents: [string, SerializedAgentEntry][];
    todos: TodoEntry[];
  };
}

// --- Transcript line types ---

interface TranscriptLine {
  timestamp?: string;
  message?: {
    content?: ContentBlock[];
  };
}

interface ContentBlock {
  type: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  is_error?: boolean;
}

function isTranscriptLine(obj: unknown): obj is TranscriptLine {
  return typeof obj === 'object' && obj !== null;
}

// --- Cache serialization ---

function serializeToolEntry(entry: ToolEntry): SerializedToolEntry {
  return {
    name: entry.name,
    target: entry.target,
    status: entry.status,
    startTime: entry.startTime.toISOString(),
    endTime: entry.endTime?.toISOString(),
  };
}

function deserializeToolEntry(entry: SerializedToolEntry): ToolEntry {
  return {
    name: entry.name,
    target: entry.target,
    status: entry.status,
    startTime: new Date(entry.startTime),
    endTime: entry.endTime ? new Date(entry.endTime) : undefined,
  };
}

function serializeAgentEntry(entry: AgentEntry): SerializedAgentEntry {
  return {
    type: entry.type,
    model: entry.model,
    description: entry.description,
    status: entry.status,
    startTime: entry.startTime.toISOString(),
    endTime: entry.endTime?.toISOString(),
  };
}

function deserializeAgentEntry(entry: SerializedAgentEntry): AgentEntry {
  return {
    type: entry.type,
    model: entry.model,
    description: entry.description,
    status: entry.status,
    startTime: new Date(entry.startTime),
    endTime: entry.endTime ? new Date(entry.endTime) : undefined,
  };
}

// --- Cache I/O ---

function loadTranscriptCache(filePath: string, currentFileSize: number): TranscriptCache | null {
  try {
    if (!fs.existsSync(TRANSCRIPT_CACHE_FILE)) return null;
    const content = JSON.parse(fs.readFileSync(TRANSCRIPT_CACHE_FILE, 'utf-8')) as TranscriptCache;
    // Valid if same file and file hasn't shrunk (shrink = new session)
    if (content.filePath === filePath && content.fileSize <= currentFileSize) {
      return content;
    }
    return null;
  } catch {
    return null;
  }
}

function saveTranscriptCache(
  filePath: string,
  fileSize: number,
  toolMap: Map<string, ToolEntry>,
  agentMap: Map<string, AgentEntry>,
  todos: TodoEntry[],
  result: TranscriptData,
): void {
  try {
    const toolEntries = Array.from(toolMap.entries()).slice(-(MAX_TRANSCRIPT_TOOLS * 2));
    const agentEntries = Array.from(agentMap.entries()).slice(-(MAX_TRANSCRIPT_AGENTS * 2));

    const cache: TranscriptCache = {
      filePath,
      fileSize,
      data: {
        toolCallCount: result.toolCallCount,
        agentCallCount: result.agentCallCount,
        skillCallCount: result.skillCallCount,
        sessionStart: result.sessionStart?.toISOString(),
        isThinking: result.isThinking,
        lastSkill: result.lastSkill
          ? { name: result.lastSkill.name, timestamp: result.lastSkill.timestamp.toISOString() }
          : undefined,
        tools: toolEntries.map(([id, entry]) => [id, serializeToolEntry(entry)]),
        agents: agentEntries.map(([id, entry]) => [id, serializeAgentEntry(entry)]),
        todos,
      },
    };

    fs.writeFileSync(TRANSCRIPT_CACHE_FILE, JSON.stringify(cache), { mode: 0o600 });
  } catch (e) {
    debugError('transcript cache write', e);
  }
}

// --- Main parser with incremental reading ---

export async function parseTranscript(transcriptPath: string): Promise<TranscriptData> {
  const result: TranscriptData = {
    tools: [],
    agents: [],
    todos: [],
    toolCallCount: 0,
    agentCallCount: 0,
    skillCallCount: 0,
  };

  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return result;
  }

  const fileStat = fs.statSync(transcriptPath);
  const fileSize = fileStat.size;

  const cache = loadTranscriptCache(transcriptPath, fileSize);

  const toolMap = new Map<string, ToolEntry>();
  const agentMap = new Map<string, AgentEntry>();
  let latestTodos: TodoEntry[] = [];
  let startOffset = 0;

  if (cache) {
    // Restore cached state
    result.toolCallCount = cache.data.toolCallCount;
    result.agentCallCount = cache.data.agentCallCount;
    result.skillCallCount = cache.data.skillCallCount;
    result.sessionStart = cache.data.sessionStart ? new Date(cache.data.sessionStart) : undefined;
    result.isThinking = cache.data.isThinking;
    if (cache.data.lastSkill) {
      result.lastSkill = {
        name: cache.data.lastSkill.name,
        timestamp: new Date(cache.data.lastSkill.timestamp),
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

    // File unchanged — return cached data immediately (fastest path)
    if (fileSize === cache.fileSize) {
      result.tools = Array.from(toolMap.values()).slice(-MAX_TRANSCRIPT_TOOLS);
      result.agents = Array.from(agentMap.values()).slice(-MAX_TRANSCRIPT_AGENTS);
      result.todos = latestTodos;
      return result;
    }
  }

  // Parse only new content from startOffset (JSONL is append-only)
  try {
    const fileStream = fs.createReadStream(transcriptPath, { start: startOffset });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const parsed = JSON.parse(line);
        if (isTranscriptLine(parsed)) {
          processEntry(parsed, toolMap, agentMap, latestTodos, result);
        }
      } catch {
        // Skip parse errors (including partial lines at offset boundary)
      }
    }
  } catch (e) {
    debugError('transcript read', e);
  }

  result.tools = Array.from(toolMap.values()).slice(-MAX_TRANSCRIPT_TOOLS);
  result.agents = Array.from(agentMap.values()).slice(-MAX_TRANSCRIPT_AGENTS);
  result.todos = latestTodos;

  // Save cache for next invocation
  saveTranscriptCache(transcriptPath, fileSize, toolMap, agentMap, latestTodos, result);

  return result;
}

// --- Entry processor ---

function processEntry(
  entry: TranscriptLine,
  toolMap: Map<string, ToolEntry>,
  agentMap: Map<string, AgentEntry>,
  latestTodos: TodoEntry[],
  result: TranscriptData,
): void {
  const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();

  if (!result.sessionStart && entry.timestamp) {
    result.sessionStart = timestamp;
  }

  const content = entry.message?.content;
  if (!content || !Array.isArray(content)) return;

  for (const block of content) {
    if (block.type === 'thinking') {
      result.isThinking = true;
    }

    if (block.type === 'text') {
      result.isThinking = false;
    }

    if (block.type === 'tool_use' && block.id && block.name) {
      const toolEntry: ToolEntry = {
        name: block.name,
        target: extractTarget(block.name, block.input),
        status: 'running',
        startTime: timestamp,
      };

      if (block.name === 'Task') {
        const input = block.input as Record<string, unknown>;
        const agentEntry: AgentEntry = {
          type: (input?.subagent_type as string) ?? 'unknown',
          model: (input?.model as string) ?? undefined,
          description: (input?.description as string) ?? undefined,
          status: 'running',
          startTime: timestamp,
        };
        agentMap.set(block.id, agentEntry);
        result.agentCallCount++;
      } else if (block.name === 'Skill') {
        const input = block.input as Record<string, unknown>;
        const skillName = (input?.skill as string) ?? 'unknown';
        result.lastSkill = { name: skillName, timestamp };
        result.skillCallCount++;
      } else if (block.name === 'TodoWrite') {
        const input = block.input as { todos?: TodoEntry[] };
        if (input?.todos && Array.isArray(input.todos)) {
          latestTodos.length = 0;
          latestTodos.push(...input.todos);
        }
      } else {
        toolMap.set(block.id, toolEntry);
        result.toolCallCount++;
      }
    }

    if (block.type === 'tool_result' && block.tool_use_id) {
      const tool = toolMap.get(block.tool_use_id);
      if (tool) {
        tool.status = block.is_error ? 'error' : 'completed';
        tool.endTime = timestamp;
      }

      const agent = agentMap.get(block.tool_use_id);
      if (agent) {
        agent.status = 'completed';
        agent.endTime = timestamp;
      }
    }
  }
}

function extractTarget(toolName: string, input?: Record<string, unknown>): string | undefined {
  if (!input) return undefined;

  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return (input.file_path as string) ?? (input.path as string);
    case 'Glob':
    case 'Grep':
      return input.pattern as string;
    case 'Bash': {
      const cmd = input.command as string;
      return cmd?.slice(0, 30) + (cmd?.length > 30 ? '...' : '');
    }
  }
  return undefined;
}
