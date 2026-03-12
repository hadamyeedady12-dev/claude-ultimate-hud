import type { RenderContext, Translations } from '../types.js';
import { COLORS, RESET, colorize, getColorForPercent, renderProgressBar } from '../utils/colors.js';
import { formatTokens, formatTimeRemaining, shortenModelName } from '../utils/formatters.js';
import { dim } from '../utils/colors.js';
import { CONTEXT_HIGH_THRESHOLD } from '../constants.js';

const SEP = ` ${COLORS.dim}│${RESET} `;

export function renderSessionLine(ctx: RenderContext, t: Translations): string {
  const parts: string[] = [];

  const modelName = shortenModelName(ctx.stdin.model.display_name);
  parts.push(`${COLORS.cyan}🤖 ${modelName}${RESET}`);

  const usage = ctx.stdin.context_window.current_usage;
  const nativePercent = ctx.stdin.used_percentage;

  if (!usage && nativePercent == null) {
    parts.push(colorize(t.errors.no_context, COLORS.dim));
    return parts.join(SEP);
  }

  const currentTokens = usage
    ? usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens
    : 0;
  const totalTokens = ctx.stdin.context_window.context_window_size;

  // Prefer native percentage if available
  const percent =
    nativePercent != null
      ? Math.min(100, Math.round(nativePercent))
      : Math.min(100, Math.round((currentTokens / totalTokens) * 100));

  parts.push(renderProgressBar(percent));

  const percentColor = getColorForPercent(percent);
  parts.push(colorize(`${percent}%`, percentColor));

  parts.push(`${formatTokens(currentTokens)}/${formatTokens(totalTokens)}`);

  // Token breakdown when high context (≥ 85%)
  if (
    percent >= CONTEXT_HIGH_THRESHOLD &&
    usage &&
    ctx.config.display?.showTokenBreakdown !== false
  ) {
    const inTokens = formatTokens(usage.input_tokens);
    const cacheTokens = formatTokens(
      usage.cache_creation_input_tokens + usage.cache_read_input_tokens,
    );
    parts.push(dim(`(in: ${inTokens}, cache: ${cacheTokens})`));
  }

  const rateParts = buildRateLimitsSection(ctx, t);
  if (rateParts) {
    parts.push(rateParts);
  }

  return parts.join(SEP);
}

function buildRateLimitsSection(ctx: RenderContext, t: Translations): string | null {
  const limits = ctx.rateLimits;
  if (!limits) return colorize('🔑 ?', COLORS.yellow);

  const parts: string[] = [];

  if (limits.five_hour) {
    const pct = Math.round(limits.five_hour.utilization);
    const color = getColorForPercent(pct);
    let text = `${t.labels['5h']}: ${colorize(`${pct}%`, color)}`;
    if (limits.five_hour.resets_at) {
      const remaining = formatTimeRemaining(limits.five_hour.resets_at, t);
      text += ` (${remaining})`;
    }
    parts.push(text);
  }

  const isMaxPlan = ctx.config.plan === 'max100' || ctx.config.plan === 'max200';

  if (isMaxPlan && (limits.seven_day || limits.seven_day_sonnet)) {
    const sevenDayParts: string[] = [];

    if (limits.seven_day) {
      const pct = Math.round(limits.seven_day.utilization);
      const color = getColorForPercent(pct);
      sevenDayParts.push(`${t.labels['7d_all']} ${colorize(`${pct}%`, color)}`);
    }

    if (limits.seven_day_sonnet) {
      const pct = Math.round(limits.seven_day_sonnet.utilization);
      const color = getColorForPercent(pct);
      sevenDayParts.push(`${t.labels['7d_sonnet']} ${colorize(`${pct}%`, color)}`);
    }

    if (sevenDayParts.length > 0) {
      parts.push(`${t.labels['7d']}: ${sevenDayParts.join(SEP)}`);
    }
  }

  return parts.length > 0 ? parts.join(SEP) : null;
}
