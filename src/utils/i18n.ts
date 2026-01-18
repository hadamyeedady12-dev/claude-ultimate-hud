import { execSync } from 'node:child_process';
import type { Config, Translations } from '../types.js';

const EN: Translations = {
  labels: {
    '5h': '5h',
    '7d': '7d',
    '7d_all': 'all',
    '7d_sonnet': 'Sonnet',
  },
  time: {
    hours: ' hours',
    minutes: ' minutes',
    shortHours: 'h',
    shortMinutes: 'm',
  },
  errors: {
    no_context: 'No context data',
  },
};

const KO: Translations = {
  labels: {
    '5h': '5시간',
    '7d': '7일',
    '7d_all': '전체',
    '7d_sonnet': '소넷',
  },
  time: {
    hours: '시간',
    minutes: '분',
    shortHours: '시간',
    shortMinutes: '분',
  },
  errors: {
    no_context: '컨텍스트 데이터 없음',
  },
};

function getMacOSLocale(): string {
  if (process.platform !== 'darwin') return '';
  try {
    return execSync('defaults read -g AppleLocale', { encoding: 'utf-8', timeout: 1000 }).trim();
  } catch {
    return '';
  }
}

function isValidLangCode(lang: string): boolean {
  if (!lang) return false;
  const lower = lang.toLowerCase();
  // Skip generic/neutral locales that don't indicate a specific language
  return !lower.startsWith('c.') && lower !== 'c' && lower !== 'posix';
}

function detectLanguage(): 'en' | 'ko' {
  // Check environment variables first
  const envLang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || '';
  if (isValidLangCode(envLang)) {
    if (envLang.toLowerCase().startsWith('ko')) return 'ko';
    return 'en';
  }

  // Fallback: On macOS, check system locale via AppleLocale
  const macLocale = getMacOSLocale();
  if (macLocale.toLowerCase().startsWith('ko')) return 'ko';

  return 'en';
}

export function getTranslations(config: Config): Translations {
  const lang = config.language === 'auto' ? detectLanguage() : config.language;
  return lang === 'ko' ? KO : EN;
}
