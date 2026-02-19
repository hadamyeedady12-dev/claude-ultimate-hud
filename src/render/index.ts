import type { RenderContext, Translations } from '../types.js';
import { RESET } from '../utils/colors.js';
import { renderSessionLine } from './session-line.js';
import { renderProjectLine } from './project-line.js';
import { renderToolsLine, renderAgentsLine, renderTodosLine } from './activity-lines.js';
import { renderOmcLine } from './omc-line.js';
import { renderContextWarning } from './context-warning.js';

export function render(ctx: RenderContext, t: Translations): void {
  const lines = [
    renderSessionLine(ctx, t),
    renderOmcLine(ctx),
    renderProjectLine(ctx),
    renderToolsLine(ctx),
    renderAgentsLine(ctx),
    renderTodosLine(ctx),
    renderContextWarning(ctx, t),
  ].filter(Boolean);

  for (const line of lines) {
    console.log(`${RESET}${line.replace(/ /g, '\u00A0')}`);
  }
}
