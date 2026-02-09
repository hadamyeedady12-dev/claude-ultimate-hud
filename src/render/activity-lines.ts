import type { RenderContext, ToolEntry, AgentEntry } from '../types.js';
import { dim, cyan, yellow, green, magenta } from '../utils/colors.js';
import { truncate, truncatePath } from '../utils/formatters.js';
import {
  MAX_RUNNING_TOOLS,
  MAX_COMPLETED_TOOL_TYPES,
  MAX_AGENTS_DISPLAY,
  MAX_COMPLETED_AGENTS,
  MAX_AGENT_DESC_LENGTH,
  MAX_TODO_CONTENT_LENGTH,
} from '../constants.js';

export function renderToolsLine(ctx: RenderContext): string | null {
  const { tools } = ctx.transcript;
  if (tools.length === 0) return null;

  const parts: string[] = [];

  const runningTools = tools.filter((t) => t.status === 'running');
  const completedTools = tools.filter((t) => t.status === 'completed' || t.status === 'error');

  for (const tool of runningTools.slice(-MAX_RUNNING_TOOLS)) {
    const target = tool.target ? truncatePath(tool.target) : '';
    parts.push(`${yellow('◐')} ${cyan(tool.name)}${target ? dim(`: ${target}`) : ''}`);
  }

  const toolCounts = new Map<string, number>();
  for (const tool of completedTools) {
    const count = toolCounts.get(tool.name) ?? 0;
    toolCounts.set(tool.name, count + 1);
  }

  const sortedTools = Array.from(toolCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_COMPLETED_TOOL_TYPES);

  for (const [name, count] of sortedTools) {
    parts.push(`${green('✓')} ${name} ${dim(`×${count}`)}`);
  }

  return parts.length > 0 ? parts.join(' | ') : null;
}

export function renderAgentsLine(ctx: RenderContext): string | null {
  const { agents } = ctx.transcript;

  const runningAgents = agents.filter((a) => a.status === 'running');
  const recentCompleted = agents.filter((a) => a.status === 'completed').slice(-MAX_COMPLETED_AGENTS);

  const toShow = [...runningAgents, ...recentCompleted].slice(-MAX_AGENTS_DISPLAY);
  if (toShow.length === 0) return null;

  const lines: string[] = [];

  for (const agent of toShow) {
    lines.push(formatAgent(agent));
  }

  return lines.join('\n');
}

function formatAgent(agent: AgentEntry): string {
  const statusIcon = agent.status === 'running' ? yellow('◐') : green('✓');
  const type = magenta(agent.type);
  const model = agent.model ? dim(`[${agent.model}]`) : '';
  const desc = agent.description ? dim(`: ${truncate(agent.description, MAX_AGENT_DESC_LENGTH)}`) : '';
  const elapsed = formatElapsed(agent);

  return `${statusIcon} ${type}${model ? ` ${model}` : ''}${desc} ${dim(`(${elapsed})`)}`;
}

function formatElapsed(agent: AgentEntry): string {
  const now = Date.now();
  const start = agent.startTime.getTime();
  const end = agent.endTime?.getTime() ?? now;
  const ms = end - start;

  if (ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;

  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m${secs}s`;
}

export function renderTodosLine(ctx: RenderContext): string | null {
  const { todos } = ctx.transcript;
  if (!todos || todos.length === 0) return null;

  const inProgress = todos.find((t) => t.status === 'in_progress');
  const completed = todos.filter((t) => t.status === 'completed').length;
  const total = todos.length;

  if (!inProgress) {
    if (completed === total && total > 0) {
      return `${green('✓')} All todos complete ${dim(`(${completed}/${total})`)}`;
    }
    return null;
  }

  const content = truncate(inProgress.content, MAX_TODO_CONTENT_LENGTH);
  const progress = dim(`(${completed}/${total})`);

  return `${yellow('▸')} ${content} ${progress}`;
}
