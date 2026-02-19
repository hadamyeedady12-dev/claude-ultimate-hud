import type { RenderContext, Translations } from '../types.js';
import { COLORS, RESET } from '../utils/colors.js';
import { AUTOCOMPACT_BUFFER } from '../constants.js';

export function renderContextWarning(ctx: RenderContext, t: Translations): string {
  const usage = ctx.stdin.context_window.current_usage;
  if (!usage) return '';

  const baseTokens = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
  const totalTokens = ctx.stdin.context_window.context_window_size;
  if (totalTokens <= 0) return '';

  const currentTokens = baseTokens + AUTOCOMPACT_BUFFER;
  const percent = Math.min(100, Math.round((currentTokens / totalTokens) * 100));

  if (percent >= 90) {
    const template = t.contextWarning?.critical ?? 'Context {pct}% - /compact recommended!';
    return `${COLORS.red}\u{1F534} ${template.replace('{pct}', String(percent))}${RESET}`;
  }

  if (percent >= 80) {
    const template = t.contextWarning?.warning ?? 'Context {pct}% - consider /compact';
    return `${COLORS.yellow}\u{26A0}\u{FE0F} ${template.replace('{pct}', String(percent))}${RESET}`;
  }

  return '';
}
