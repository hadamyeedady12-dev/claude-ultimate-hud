import type { RenderContext } from '../types.js';
import { COLORS, RESET, colorize } from '../utils/colors.js';

export function renderOmcLine(ctx: RenderContext): string {
  const parts: string[] = [];
  const omc = ctx.omcState;
  const t = ctx.transcript;

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
  if (t.isThinking) {
    parts.push(`${COLORS.magenta}\u{1F4AD} thinking${RESET}`);
  }

  // Last skill invoked
  if (t.lastSkill) {
    parts.push(`${COLORS.cyan}\u{1F3AF} skill:${t.lastSkill.name}${RESET}`);
  }

  // Call counts (universal - always shows if any calls exist)
  if (t.toolCallCount > 0 || t.agentCallCount > 0 || t.skillCallCount > 0) {
    const counts = [
      `T:${t.toolCallCount}`,
      `A:${t.agentCallCount}`,
      `S:${t.skillCallCount}`,
    ].join(' ');
    parts.push(colorize(counts, COLORS.dim));
  }

  if (parts.length === 0) return '';

  return parts.join(` ${COLORS.dim}\u{2502}${RESET} `);
}
