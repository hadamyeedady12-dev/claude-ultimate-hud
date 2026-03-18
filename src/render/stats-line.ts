import type { RenderContext, Translations } from '../types.js';
import { COLORS, RESET, colorize } from '../utils/colors.js';
import { formatTokens } from '../utils/formatters.js';

export function renderStatsLine(ctx: RenderContext, t: Translations): string {
  const parts: string[] = [];
  const tr = ctx.transcript;

  // Thinking state
  if (tr.isThinking) {
    parts.push(`${COLORS.magenta}\u{1F4AD} ${t.stats.thinking}${RESET}`);
  }

  // Last skill invoked
  if (tr.lastSkill) {
    parts.push(`${COLORS.cyan}\u{1F3AF} skill:${tr.lastSkill.name}${RESET}`);
  }

  // Burn rate
  if (ctx.burnRate != null && ctx.burnRate > 0) {
    parts.push(colorize(`🔥 ${formatTokens(ctx.burnRate)} tok/min`, COLORS.dim));
  }

  // Lines changed
  const added = ctx.stdin.total_lines_added;
  const removed = ctx.stdin.total_lines_removed;
  if (added != null || removed != null) {
    const linesParts: string[] = [];
    if (added != null && added > 0) linesParts.push(`+${added}`);
    if (removed != null && removed > 0) linesParts.push(`-${removed}`);
    if (linesParts.length > 0) {
      parts.push(colorize(linesParts.join(' '), COLORS.dim));
    }
  }

  if (parts.length === 0) return '';

  return parts.join(` ${COLORS.dim}\u{2502}${RESET} `);
}
