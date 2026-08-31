import { KEYWORDS, STOP_WORDS, MIN_SCORE } from '../config/keywords.js';

// Считает балл заказа и объясняет, почему он прошёл или не прошёл.
export function score(order) {
  const haystack = `${order.title || ''}\n${order.description || ''}`;

  for (const stop of STOP_WORDS) {
    if (stop.test(haystack)) {
      return { score: 0, tags: [], passed: false, reason: 'stop-word' };
    }
  }

  let total = 0;
  const tags = [];
  for (const rule of KEYWORDS) {
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
