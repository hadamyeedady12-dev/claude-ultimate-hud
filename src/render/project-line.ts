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

  const { configCounts } = ctx;

  if (configCounts.claudeMdCount > 0) {
    parts.push(dim(`${configCounts.claudeMdCount} CLAUDE.md`));
  }

  if (configCounts.rulesCount > 0) {
    parts.push(dim(`${configCounts.rulesCount} rules`));
  }

  if (configCounts.mcpCount > 0) {
    parts.push(dim(`${configCounts.mcpCount} MCPs`));
  }

  if (configCounts.hooksCount > 0) {
    parts.push(dim(`${configCounts.hooksCount} hooks`));
  }

  if (ctx.sessionDuration) {
    parts.push(dim(`⏱️ ${ctx.sessionDuration}`));
  }

  return parts.join(SEP);
}
