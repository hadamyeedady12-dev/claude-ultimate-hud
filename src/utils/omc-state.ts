import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OmcState } from '../types.js';
import { debugError } from './errors.js';

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) return null;
    const stat = statSync(filePath);
    if (!stat.isFile() || Date.now() - stat.mtimeMs > STALE_THRESHOLD_MS) return null;
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function findSessionStateDir(omcStateDir: string): string | null {
  const sessionsDir = join(omcStateDir, 'sessions');
  try {
    if (!existsSync(sessionsDir)) return null;
    const entries = readdirSync(sessionsDir, { withFileTypes: true });
    let latest: { name: string; mtime: number } | null = null;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const mtime = statSync(join(sessionsDir, entry.name)).mtimeMs;
        if (!latest || mtime > latest.mtime) {
          latest = { name: entry.name, mtime };
        }
      } catch {
        // skip inaccessible dirs
      }
    }
    return latest ? join(sessionsDir, latest.name) : null;
  } catch {
    return null;
  }
}

function readStateFile(cwd: string, filename: string): Record<string, unknown> | null {
  const omcStateDir = join(cwd, '.omc', 'state');

  // 1. Session-scoped (newest mtime first)
  const sessionDir = findSessionStateDir(omcStateDir);
  if (sessionDir) {
    const data = readJsonFile(join(sessionDir, filename));
    if (data) return data;
  }

  // 2. Legacy state dir
  const data = readJsonFile(join(omcStateDir, filename));
  if (data) return data;

  // 3. Root .omc fallback
  return readJsonFile(join(cwd, '.omc', filename));
}

export async function readOmcState(cwd?: string): Promise<OmcState> {
  const state: OmcState = {};
  if (!cwd) return state;

  // Fast path: skip entirely if .omc dir doesn't exist
  if (!existsSync(join(cwd, '.omc'))) return state;

  try {
    const ralph = readStateFile(cwd, 'ralph-state.json');
    if (ralph?.active) {
      state.ralph = {
        active: true,
        iteration: (ralph.iteration as number) ?? 0,
        maxIterations: (ralph.max_iterations as number) ?? 0,
      };
    }

    const ultrawork = readStateFile(cwd, 'ultrawork-state.json');
    if (ultrawork?.active) {
      state.ultrawork = { active: true };
    }

    const autopilot = readStateFile(cwd, 'autopilot-state.json');
    if (autopilot?.active) {
      state.autopilot = {
        active: true,
        phase: (autopilot.current_phase as string) ?? '',
        iteration: (autopilot.iteration as number) ?? 0,
        maxIterations: (autopilot.max_iterations as number) ?? 0,
      };
    }
  } catch (e) {
    debugError('omc-state read', e);
  }

  return state;
}
