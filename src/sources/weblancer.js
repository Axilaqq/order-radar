import { stripTags, truncate } from '../util.js';
import { DESCRIPTION_LIMIT } from '../../config/sources.js';

// Weblancer — биржа разовых заказов. Машинного доступа нет: /rss/projects/
// отдаёт 404, в robots.txt фида нет вовсе. Поэтому разбираем HTML страницы
// списка https://www.weblancer.net/freelance/ (адрес /jobs/ на неё же и
// перенаправляет).
//
// robots.txt закрывает /api/, /account/, /ajax/, /socket* и любые адреса
// с параметрами (*action=, *page=, *filter= и прочие). Чистая /freelance/
// в запретах не значится — ходим только туда, без query-строки.
//
// Разметка на Tailwind, поэтому опорные точки выбраны самые устойчивые:
//   <article>                         — одна карточка заказа;
//   <h2><a href="/freelance/…-1269182/"> — заголовок и ссылка;
//   <p class="text-gray-600 …">        — описание;
//   <span class="… text-green-600 …">  — бюджет, сразу после заголовка;
//   <span>06.09.2026</span>, «7 заявок», «285 просмотров» — строка меты.
// Если вёрстку переделают, адаптер вернёт пустой список и прогон запишет
// fetched: 0 — это и будет сигналом чинить.

// «06.09.2026» → ISO. Времени площадка не отдаёт, берём полдень UTC,
// чтобы дата не «уезжала» на сутки при пересчёте в любой часовой пояс.
export function parseDotDate(text = '') {
  const m = String(text).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}T12:00:00.000Z`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

const clean = (s = '') => stripTags(s).replace(/\s+/g, ' ').trim();

export function parseWeblancer(htmlText, source) {
  const cards = String(htmlText).split('<article').slice(1);

  return cards.map((card) => {
    const link = card.match(/<h2[^>]*>\s*<a[^>]*href="(\/freelance\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) return null;
    const href = link[1];
    const title = clean(link[2]);
    // Идентификатор — число в конце адреса: …-dorabotka-telegram-bota-1269182/
    const id = href.match(/-(\d+)\/?$/);
    if (!title || !id) return null;

    // Бюджет живёт в зелёном span рядом с заголовком. Внутри бывает пустой
    // HTML-комментарий («999<!-- --> $») — stripTags его убирает.
    const budget = clean((card.match(/<span class="[^"]*text-green[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '');
    const description = clean((card.match(/<p class="[^"]*text-gray-600[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '');

    // Рубрики площадки — отдельными ссылками-пилюлями.
    const tags = [...card.matchAll(/rounded-full[^"]*"[^>]*href="\/freelance\/[^"]+\/"[^>]*>([^<]+)<\/a>/g)]
      .map((m) => clean(m[1])).filter(Boolean);

    const date = (card.match(/<span>(\d{2}\.\d{2}\.\d{4})<\/span>/) || [])[1] || '';
    // Числа берём только из <span> строки меты, а не из любого места карточки:
    // в описании легко встретится «3 заявки» или «1000 просмотров» текстом.
    // Корень «заяв» без окончания — потому что площадка пишет и «3 заявки»,
    // и «7 заявок», общего куска «заявк» у них нет.
    const bids = (card.match(/<span>(\d+)\s+заяв[^<]*<\/span>/) || [])[1];
    const views = (card.match(/<span>(\d+)\s+просмотр[^<]*<\/span>/) || [])[1];

    return {
      source_id: source.id,
      external_id: id[1],
      title,
      url: `https://www.weblancer.net${href}`,
      description: truncate(description, DESCRIPTION_LIMIT),
      // Служебные строки — отдельно: в оценку они не входят, сборщик
      // приклеит их к описанию уже после скоринга.
      extra: [
        tags.length ? `Рубрики: ${tags.join(', ')}` : '',
        bids ? `Заявок: ${bids}` : '',
        views ? `Просмотров: ${views}` : '',
      ].filter(Boolean).join('\n'),
      budget: budget || null,
      published_at: parseDotDate(date),
    };
  }).filter((o) => o && o.external_id && o.title);
}
