import { stripTags, toIso, truncate } from '../util.js';
import { DESCRIPTION_LIMIT } from '../../config/sources.js';

// Jobicy: https://jobicy.com/api/v2/remote-jobs — JSON без авторизации.
// Условие площадки: ссылка должна вести на оригинал вакансии, что мы и делаем.
export function parseJobicy(payload, source) {
  const list = Array.isArray(payload?.jobs) ? payload.jobs : [];
  return list.map((row) => {
    const salary = [row.annualSalaryMin, row.annualSalaryMax].filter((n) => Number(n) > 0);
    const currency = row.salaryCurrency || 'USD';
    const geo = row.jobGeo ? `География: ${row.jobGeo}` : '';
    return {
      source_id: source.id,
      external_id: String(row.id || row.jobSlug || row.url),
      title: [row.companyName, row.jobTitle].filter(Boolean).join(' — '),
      url: row.url || null,
      description: truncate([stripTags(row.jobExcerpt || row.jobDescription || ''), geo]
        .filter(Boolean).join('\n'), DESCRIPTION_LIMIT),
      budget: salary.length ? `${salary.join('–')} ${currency}/год` : null,
      published_at: toIso(row.pubDate),
    };
  }).filter((o) => o.external_id && o.title);
}
