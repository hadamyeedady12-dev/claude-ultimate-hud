import type { RenderContext, Translations } from '../types.js';
import { RESET } from '../utils/colors.js';
import { stripAnsi, visualWidth, sliceVisible } from '../utils/formatters.js';
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

  const output: string[] = [];
  for (const line of lines) {
    let outputLine = `${RESET}${line!.replace(/ /g, '\u00A0')}`;
    // Fast path: if plain text length < half terminal width, no CJK char can overflow
    const plain = stripAnsi(outputLine);
    if (plain.length > termWidth / 2 && visualWidth(outputLine) > termWidth) {
      outputLine = sliceVisible(outputLine, termWidth);
    }
    output.push(outputLine);
  }
  process.stdout.write(output.join('\n') + '\n');
}
