import type { Config, Translations } from '../types.js';

const EN: Translations = {
  labels: {
    '5h': '5h',
    '7d_all': '7d',
    '7d_sonnet': '7d(Sonnet)',
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
    '7d_all': '7일',
    '7d_sonnet': '7일(소넷만)',
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

function detectLanguage(): 'en' | 'ko' {
  const lang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || '';
  if (lang.toLowerCase().startsWith('ko')) return 'ko';
  return 'en';
}

export function getTranslations(config: Config): Translations {
  const lang = config.language === 'auto' ? detectLanguage() : config.language;
  return lang === 'ko' ? KO : EN;
}
