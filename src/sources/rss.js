import { stripTags, tag, toIso, truncate } from '../util.js';
import { DESCRIPTION_LIMIT } from '../../config/sources.js';

// Разбирает стандартную RSS 2.0 ленту (FL.ru, Freelancer.com и подобные).
export function parseRss(xml, source) {
  const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  return items.map((item) => {
    const link = tag(item, 'link');
    const guid = tag(item, 'guid') || link;
    const description = stripTags(tag(item, 'description'));
    return {
      source_id: source.id,
      external_id: guid || link,
      title: stripTags(tag(item, 'title')),
      url: link || null,
      description: truncate(description, DESCRIPTION_LIMIT),
      budget: extractBudget(`${tag(item, 'title')} ${description}`),
      published_at: toIso(tag(item, 'pubDate')),
    };
  }).filter((o) => o.external_id && o.title);
}

// Пытается вытащить бюджет из текста. Не находит — вернёт null, и в уведомлении будет «не указан».
export function extractBudget(text = '') {
  const m = text.match(/(?:бюджет|budget|оплата|цена)\D{0,12}((?:\d[\d\s.,]*)(?:\s?(?:руб|₽|rub|usd|\$|€|eur|грн))?)/i)
    || text.match(/((?:\d[\d\s]{2,})\s?(?:руб|₽|rub))/i)
    || text.match(/(\$\s?\d[\d\s.,]*)/);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}
