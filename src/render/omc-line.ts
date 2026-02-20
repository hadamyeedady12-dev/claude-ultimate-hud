import type { RenderContext, Translations } from '../types.js';
import { COLORS, RESET, colorize } from '../utils/colors.js';

export function renderOmcLine(ctx: RenderContext, t: Translations): string {
  const parts: string[] = [];
  const omc = ctx.omcState;
  const tr = ctx.transcript;

  // OMC mode states (only visible when active)
  if (omc.ralph?.active) {
    const iter = omc.ralph.maxIterations > 0
      ? `${omc.ralph.iteration}/${omc.ralph.maxIterations}`
      : `${omc.ralph.iteration}`;
    parts.push(`${COLORS.cyan}\u{1F504} ralph:${iter}${RESET}`);
  }

  if (omc.autopilot?.active) {
    const phase = omc.autopilot.phase || '?';
    const iter = omc.autopilot.maxIterations > 0
      ? `(${omc.autopilot.iteration}/${omc.autopilot.maxIterations})`
      : '';
    parts.push(`${COLORS.green}\u{1F916} autopilot:${phase}${iter}${RESET}`);
  }

  if (omc.ultrawork?.active) {
    parts.push(`${COLORS.yellow}\u{26A1} ultrawork${RESET}`);
  }

  // Thinking state (universal - works without OMC)
  if (tr.isThinking) {
    parts.push(`${COLORS.magenta}\u{1F4AD} ${t.omc.thinking}${RESET}`);
  }

  // Last skill invoked
  if (tr.lastSkill) {
    parts.push(`${COLORS.cyan}\u{1F3AF} skill:${tr.lastSkill.name}${RESET}`);
  }

  // Call counts (universal - always shows if any calls exist)
  if (tr.toolCallCount > 0 || tr.agentCallCount > 0 || tr.skillCallCount > 0) {
    const counts = [
      `T:${tr.toolCallCount}`,
      `A:${tr.agentCallCount}`,
      `S:${tr.skillCallCount}`,
    ].join(' ');
    parts.push(colorize(counts, COLORS.dim));
  }

  if (parts.length === 0) return '';

  return parts.join(` ${COLORS.dim}\u{2502}${RESET} `);
}
