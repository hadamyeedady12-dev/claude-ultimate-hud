export const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

export const RESET = COLORS.reset;

export function colorize(text: string, color: string): string {
  return `${color}${text}${RESET}`;
}

export function dim(text: string): string {
  return colorize(text, COLORS.dim);
}

export function cyan(text: string): string {
  return colorize(text, COLORS.cyan);
}

export function green(text: string): string {
  return colorize(text, COLORS.green);
}

export function yellow(text: string): string {
  return colorize(text, COLORS.yellow);
}

export function red(text: string): string {
  return colorize(text, COLORS.red);
}

export function magenta(text: string): string {
  return colorize(text, COLORS.magenta);
}

export function getColorForPercent(percent: number): string {
  if (percent <= 50) return COLORS.green;
  if (percent <= 80) return COLORS.yellow;
  return COLORS.red;
}

export function renderProgressBar(percent: number, width = 10): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const color = getColorForPercent(percent);
  return `${color}${'█'.repeat(filled)}${COLORS.dim}${'░'.repeat(empty)}${RESET}`;
}
