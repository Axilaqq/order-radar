import { stripTags, toIso, truncate } from '../util.js';
import { DESCRIPTION_LIMIT } from '../../config/sources.js';

// Разбирает REST-ответ Биржи заказов Инфостарт:
// https://infostart.ru/rest/v1/freelance/orders?limit=50
// Эндпоинт отдаёт JSON без токена (проверено 31.08.2026).
// Это профильная площадка по 1С: комиссии нет, расчёты напрямую разрешены.
export function parseInfostart(payload, source) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  return list.map((o) => {
    const configs = (o.configurations || []).map((c) => String(c.title || '').trim()).filter(Boolean);
    const budgetNum = Number(o.budget) || 0;
    const responses = Number(o.number_responses) || 0;
    const description = stripTags(o.description || '');
    return {
      source_id: source.id,
      external_id: String(o.id),
      title: String(o.title || '').trim(),
      url: o.id ? `https://infostart.ru/project/#/orders/${o.id}` : null,
      description: truncate(description, DESCRIPTION_LIMIT),
      // Служебные строки. В ОЦЕНКУ НЕ ВХОДЯТ — сборщик приклеит их к описанию
      // уже после скоринга. Иначе названия конфигураций («1С:Управление
      // торговлей 11») давали балл за правило «1С» каждому заказу подряд.
      extra: [
        configs.length ? `Конфигурации: ${configs.join(', ')}` : '',
        `Откликов: ${responses}`,
      ].filter(Boolean).join('\n'),
      // Бюджет часто не указан — тогда null, и в уведомлении будет «не указан».
      budget: budgetNum > 0 ? `${budgetNum} ₽` : null,
      published_at: toIso(o.published_at),
    };
  }).filter((o) => o.external_id && o.title);
}
