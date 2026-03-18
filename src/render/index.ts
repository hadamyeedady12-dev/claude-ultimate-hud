import type { RenderContext, Translations } from '../types.js';
import { RESET } from '../utils/colors.js';
import { visualWidth, sliceVisible } from '../utils/formatters.js';
import { renderSessionLine } from './session-line.js';
import { renderProjectLine } from './project-line.js';
import { renderToolsLine, renderAgentsLine, renderTodosLine } from './activity-lines.js';
import { renderStatsLine } from './stats-line.js';
import { renderContextWarning } from './context-warning.js';

export function render(ctx: RenderContext, t: Translations): void {
  const display = ctx.config.display ?? {};
  const termWidth = process.stdout.columns || 120;

  const lines = [
    renderSessionLine(ctx, t),
    display.showStats !== false ? renderStatsLine(ctx, t) : '',
    renderProjectLine(ctx),
    display.showTools !== false ? renderToolsLine(ctx) : null,
    display.showAgents !== false ? renderAgentsLine(ctx) : null,
    display.showTodos !== false ? renderTodosLine(ctx, t) : null,
    renderContextWarning(ctx, t),
  ].filter(Boolean);

  for (const line of lines) {
    let outputLine = `${RESET}${line!.replace(/ /g, '\u00A0')}`;
    if (visualWidth(outputLine) > termWidth) {
      outputLine = sliceVisible(outputLine, termWidth);
    }
    console.log(outputLine);
  }
}
