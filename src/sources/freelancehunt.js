import { stripTags, toIso, truncate } from '../util.js';
import { DESCRIPTION_LIMIT } from '../../config/sources.js';

// Разбирает публичный JSON:API Freelancehunt (https://api.freelancehunt.com/v2/projects).
export function parseFreelancehunt(payload, source) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  return list.map((row) => {
    const a = row.attributes || {};
    const budget = a.budget ? `${a.budget.amount} ${a.budget.currency}` : null;
    const skills = Array.isArray(a.skills) ? a.skills.map((s) => s.name).join(', ') : '';
    const description = stripTags(a.description_html || a.description || '');
    return {
      source_id: source.id,
      external_id: String(row.id),
      title: a.name || '',
      url: row.links?.self?.web || (row.id ? `https://freelancehunt.com/project/${row.id}.html` : null),
      description: truncate([description, skills && `Навыки: ${skills}`].filter(Boolean).join('\n'), DESCRIPTION_LIMIT),
      budget,
      published_at: toIso(a.published_at),
    };
  }).filter((o) => o.external_id && o.title);
}
