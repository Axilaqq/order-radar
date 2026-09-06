import { stripTags, toIso, truncate } from '../util.js';
import { DESCRIPTION_LIMIT } from '../../config/sources.js';

// Arbeitnow: https://www.arbeitnow.com/api/job-board-api — JSON без авторизации.
// Преимущественно Германия и Западная Европа. created_at — unix-секунды.
export function parseArbeitnow(payload, source) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  return list.map((row) => {
    const tags = Array.isArray(row.tags) ? row.tags.slice(0, 10).join(', ') : '';
    const meta = [
      row.location ? `Локация: ${row.location}` : '',
      row.remote ? 'Удалённо: да' : 'Удалённо: нет',
      tags && `Теги: ${tags}`,
    ].filter(Boolean).join('\n');
    return {
      source_id: source.id,
      external_id: String(row.slug || row.url),
      title: [row.company_name, row.title].filter(Boolean).join(' — '),
      url: row.url || null,
      description: truncate([stripTags(row.description || ''), meta].filter(Boolean).join('\n'), DESCRIPTION_LIMIT),
      // Зарплату площадка в этом фиде не отдаёт.
      budget: null,
      // created_at приходит в секундах, Date ждёт миллисекунды.
      published_at: Number(row.created_at) ? new Date(Number(row.created_at) * 1000).toISOString() : toIso(row.created_at),
    };
  }).filter((o) => o.external_id && o.title);
}
