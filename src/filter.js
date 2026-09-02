import { KEYWORDS, STOP_WORDS, MIN_SCORE, SKIP_UKRAINIAN } from '../config/keywords.js';
import { looksUkrainian } from './language.js';

// Считает балл заказа и объясняет, почему он прошёл или не прошёл.
//
// Второй аргумент — источник из config/sources.js. Из него берётся ignoreRules:
// список id правил, которые на этой площадке ничего не различают.
export function score(order, source = {}) {
  // Оцениваем ТОЛЬКО текст самого заказа. Служебные строки, которые адаптер
  // добавляет для читаемости (конфигурации, число откликов), сюда не попадают:
  // иначе площадка по 1С даёт балл за слово «1С» каждому заказу без исключения,
  // и фильтр перестаёт фильтровать.
  const haystack = `${order.title || ''}\n${order.description || ''}`;
  const ignored = new Set(source.ignoreRules || []);

  // Язык проверяем первым: разбирать по ключевым словам объявление, с которым
  // всё равно не будем работать, смысла нет.
  if (SKIP_UKRAINIAN && looksUkrainian(haystack)) {
    return { score: 0, tags: [], passed: false, reason: 'ukrainian' };
  }

  for (const stop of STOP_WORDS) {
    if (stop.test(haystack)) {
      return { score: 0, tags: [], passed: false, reason: 'stop-word' };
    }
  }

  let total = 0;
  const tags = [];
  for (const rule of KEYWORDS) {
    if (ignored.has(rule.id)) continue;
    if (rule.re.test(haystack)) {
      total += rule.w;
      if (!tags.includes(rule.tag)) tags.push(rule.tag);
    }
  }

  return {
    score: total,
    tags,
    passed: total >= MIN_SCORE,
    reason: total >= MIN_SCORE ? 'match' : 'low-score',
  };
}

export { MIN_SCORE };
