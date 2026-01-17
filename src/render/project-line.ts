import path from 'node:path';
import type { RenderContext } from '../types.js';
import { COLORS, RESET, dim, cyan, yellow, magenta } from '../utils/colors.js';

const SEP = ` ${COLORS.dim}│${RESET} `;

export function renderProjectLine(ctx: RenderContext): string {
  const parts: string[] = [];

  if (ctx.stdin.cwd) {
    const projectName = path.basename(ctx.stdin.cwd) || ctx.stdin.cwd;
    let projectPart = `📁 ${yellow(projectName)}`;
    
    if (ctx.gitBranch) {
      projectPart += ` ${magenta('git:(')}${cyan(ctx.gitBranch)}${magenta(')')}`;
    }
    parts.push(projectPart);
  }

  const { claudeMdCount, rulesCount, mcpCount, hooksCount } = ctx.configCounts;
  const configItems: [number, string][] = [
    [claudeMdCount, 'CLAUDE.md'],
    [rulesCount, 'rules'],
    [mcpCount, 'MCPs'],
    [hooksCount, 'hooks'],
  ];

  for (const [count, label] of configItems) {
    if (count > 0) {
      parts.push(dim(`${count} ${label}`));
    }
  }

  if (ctx.sessionDuration) {
    parts.push(dim(`⏱️ ${ctx.sessionDuration}`));
  }

  return parts.join(SEP);
}
