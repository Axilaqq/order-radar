import { stripTags, truncate } from '../util.js';
import { DESCRIPTION_LIMIT } from '../../config/sources.js';

// Workspace.ru — тендерная площадка. Машинного доступа у них нет:
// /rss/tenders/ отдаёт 404, /tenders/rss/ — 403, а sitemap тендеров идёт
// без lastmod и без порядка, то есть «что нового» из него не понять.
// Поэтому разбираем HTML страницы категории https://workspace.ru/tenders/crm/.
//
// robots.txt запрещает /tenders/? и /tenders/*/? — любые параметры запроса.
// Категория задана ПУТЁМ, а не фильтром, и в запретах не значится, поэтому
// ходим только туда и никогда не подставляем query-строку.
//
// Разметка серверная и устойчивая: карточка помечена data-tender-card,
// заголовок лежит в b-tender__title, бюджет и даты — в b-tender__info-item-text.
// Если вёрстка изменится, адаптер вернёт пустой список, а прогон запишет
// fetched: 0 — это и будет сигналом, что пора чинить.

const MONTHS = {
  'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
  'мая': '05', 'июня': '06', 'июля': '07', 'августа': '08',
  'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12',
};

// «04 сентября 2026» → ISO. Время площадка не отдаёт, берём полдень UTC,
// чтобы дата не «уезжала» на сутки при пересчёте в любой часовой пояс.
export function parseRuDate(text = '') {
  const m = String(text).trim().match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${String(m[1]).padStart(2, '0')}T12:00:00.000Z`;
}

// Площадка ставит неразрывные пробелы в бюджетах: «1 000 000 ₽».
// Коды указаны явно — буквальный U+00A0 в исходнике незаметно теряется.
const nbsp = (s = '') => s.replace(/[  ]|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function infoItem(card, titleRe) {
  const items = card.match(/<div class="b-tender__info-item">[\s\S]*?<\/div>\s*<\/div>/g) || [];
  for (const item of items) {
    const title = stripTags((item.match(/b-tender__info-item-title">([\s\S]*?)<\/div>/) || [])[1] || '');
    if (titleRe.test(title)) {
      return nbsp(stripTags((item.match(/b-tender__info-item-text">([\s\S]*?)<\/div>/) || [])[1] || ''));
    }
  }
  return '';
}

export function parseWorkspace(htmlText, source) {
  const cards = String(htmlText).split('data-tender-card').slice(1);

  return cards.map((card) => {
    const link = card.match(/<a\s[^>]*href="(\/tenders\/[^"]+)"[\s\S]*?>([\s\S]*?)<\/a>/);
    if (!link) return null;
    const href = link[1];
    const title = nbsp(stripTags(link[2]));
    if (!title) return null;

    // Бюджет лежит в блоке заголовка, до блока с датами. Режем по ТОЧНОМУ
    // class="b-tender__info": простое 'b-tender__info' совпало бы и с
    // 'b-tender__info-item-text', то есть отрезало бы сам бюджет.
    const titleBlock = card.split('class="b-tender__info"')[0];
    const budgetRaw = nbsp(stripTags((titleBlock.match(/b-tender__info-item-text">([\s\S]*?)<\/div>/) || [])[1] || ''));

    const published = infoItem(card, /Опубликован/i);
    const deadline = infoItem(card, /Крайний срок/i);
    const views = (card.match(/reference _views">\s*(\d+)/) || [])[1];
    const status = nbsp(stripTags((card.match(/data-change-status-text="[^"]*"\s*>([\s\S]*?)<\/div>/) || [])[1] || ''));

    return {
      source_id: source.id,
      external_id: href.replace(/^\/tenders\//, '').replace(/\/$/, ''),
      title,
      url: `https://workspace.ru${href}`,
      description: truncate([
        status,
        deadline && `Приём заявок до: ${deadline}`,
        views && `Просмотров: ${views}`,
      ].filter(Boolean).join('\n'), DESCRIPTION_LIMIT),
      budget: budgetRaw ? `${budgetRaw} ₽` : null,
      published_at: parseRuDate(published),
    };
  }).filter((o) => o && o.external_id && o.title);
}
