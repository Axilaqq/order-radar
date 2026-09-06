import { stripTags, toIso, truncate } from '../util.js';
import { DESCRIPTION_LIMIT } from '../../config/sources.js';

// RemoteOK: https://remoteok.com/api — массив JSON без авторизации.
// ВАЖНО: нулевой элемент массива — не вакансия, а юридическая заметка
// («legal» / «disclaimer»). Его надо пропускать, иначе в базу попадёт мусор.
export function parseRemoteOk(payload, source) {
  const list = Array.isArray(payload) ? payload : [];
  return list
    .filter((row) => row && (row.position || row.title) && (row.id || row.slug))
    .map((row) => {
      const salary = [row.salary_min, row.salary_max].filter((n) => Number(n) > 0);
      const tags = Array.isArray(row.tags) ? row.tags.slice(0, 12).join(', ') : '';
      return {
        source_id: source.id,
        external_id: String(row.id || row.slug),
        title: [row.company, row.position || row.title].filter(Boolean).join(' — '),
        url: row.url || (row.slug ? `https://remoteok.com/remote-jobs/${row.slug}` : null),
        description: truncate([stripTags(row.description || ''), tags && `Теги: ${tags}`]
          .filter(Boolean).join('\n'), DESCRIPTION_LIMIT),
        budget: salary.length ? `${salary.join('–')} USD/год` : null,
        published_at: toIso(row.date),
      };
    });
}
