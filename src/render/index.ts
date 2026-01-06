import type { RenderContext, Translations } from '../types.js';
import { RESET } from '../utils/colors.js';
import { renderSessionLine } from './session-line.js';
import { renderProjectLine } from './project-line.js';
import { renderToolsLine, renderAgentsLine, renderTodosLine } from './activity-lines.js';

export function render(ctx: RenderContext, t: Translations): void {
  const lines: string[] = [];

  const sessionLine = renderSessionLine(ctx, t);
  if (sessionLine) lines.push(sessionLine);

  const projectLine = renderProjectLine(ctx);
  if (projectLine) lines.push(projectLine);

  const toolsLine = renderToolsLine(ctx);
  if (toolsLine) lines.push(toolsLine);

  const agentsLine = renderAgentsLine(ctx);
  if (agentsLine) lines.push(agentsLine);

  const todosLine = renderTodosLine(ctx);
  if (todosLine) lines.push(todosLine);

  for (const line of lines) {
    const outputLine = `${RESET}${line.replace(/ /g, '\u00A0')}`;
    console.log(outputLine);
  }
}
