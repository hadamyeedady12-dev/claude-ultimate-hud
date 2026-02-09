import * as fs from 'node:fs';
import * as readline from 'node:readline';
import type { TranscriptData, ToolEntry, AgentEntry, TodoEntry } from '../types.js';
import { debugError } from './errors.js';
import { MAX_TRANSCRIPT_TOOLS, MAX_TRANSCRIPT_AGENTS } from '../constants.js';

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

export async function parseTranscript(transcriptPath: string): Promise<TranscriptData> {
  const result: TranscriptData = {
    tools: [],
    agents: [],
    todos: [],
  };

  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return result;
  }

  const toolMap = new Map<string, ToolEntry>();
  const agentMap = new Map<string, AgentEntry>();
  let latestTodos: TodoEntry[] = [];
  let totalLines = 0;
  let parseErrors = 0;

  try {
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
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
        debugError('transcript parse', e);
      }
    }
  } catch (e) {
    debugError('transcript read', e);
  }

  if (totalLines > 0 && parseErrors / totalLines > 0.5) {
    process.stderr.write(
      `[claude-ultimate-hud] WARNING: ${parseErrors}/${totalLines} transcript lines failed to parse\n`
    );
  }

  result.tools = Array.from(toolMap.values()).slice(-MAX_TRANSCRIPT_TOOLS);
  result.agents = Array.from(agentMap.values()).slice(-MAX_TRANSCRIPT_AGENTS);
  result.todos = latestTodos;

  return result;
}

function processEntry(
  entry: TranscriptLine,
  toolMap: Map<string, ToolEntry>,
  agentMap: Map<string, AgentEntry>,
  latestTodos: TodoEntry[],
  result: TranscriptData
): void {
  const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();

  if (!result.sessionStart && entry.timestamp) {
    result.sessionStart = timestamp;
  }

  const content = entry.message?.content;
  if (!content || !Array.isArray(content)) return;

  for (const block of content) {
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
      } else if (block.name === 'TodoWrite') {
        const input = block.input as { todos?: TodoEntry[] };
        if (input?.todos && Array.isArray(input.todos)) {
          latestTodos.length = 0;
          latestTodos.push(...input.todos);
        }
      } else {
        toolMap.set(block.id, toolEntry);
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
