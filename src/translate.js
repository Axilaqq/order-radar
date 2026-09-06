// Перевод иностранных объявлений на русский.
//
// Переводит Workers AI — модель @cf/meta/m2m100-1.2b. Она живёт на той же
// платформе, что и воркер, поэтому отдельный ключ и внешний сервис не нужны:
// в wrangler.jsonc добавлена привязка "ai", и модель доступна как env.AI.
//
// Переводим ТОЛЬКО те объявления, которые уже прошли фильтр и идут в
// уведомление — это единицы за прогон, а не весь поток. Перевод в базу не
// пишется: он нужен для чтения в Telegram, оригинал остаётся ссылкой.
//
// Если перевода нет (привязка не настроена, модель ответила ошибкой,
// закончилась дневная квота) — уходит оригинал. Уведомление важнее перевода.

const MODEL = '@cf/meta/m2m100-1.2b';

// Модель принимает ограниченный кусок текста. Описание режем, заголовок нет.
const MAX_DESCRIPTION_CHARS = 900;

const CYRILLIC = /[а-яёіїєґ]/gi;
const LATIN = /[a-z]/gi;

// Нужен ли перевод. Считаем буквы обоих алфавитов и сравниваем.
//
// Порог по латинице нужен, чтобы русское объявление со словами «CRM», «API»
// или «Ozon» не поехало в переводчик. Порог по кириллице — ноль: если хоть
// сколько-то русских букв есть, человек прочитает и так.
export function needsTranslation(text = '') {
  const s = String(text);
  const cyr = (s.match(CYRILLIC) || []).length;
  const lat = (s.match(LATIN) || []).length;
  return cyr === 0 && lat >= 10;
}

async function translateText(env, text) {
  const res = await env.AI.run(MODEL, {
    text,
    source_lang: 'english',
    target_lang: 'russian',
  });
  const out = String(res?.translated_text || '').trim();
  if (!out) throw new Error('пустой ответ модели');
  return out;
}

// Возвращает копию заказа с переведённым заголовком и описанием.
// Оригинальный заголовок кладём в title_original — он уходит в уведомление
// второй строкой, чтобы было видно, что именно перевели.
export async function translateOrder(env, order) {
  if (!env?.AI) return order;
  const source = `${order.title || ''}\n${order.description || ''}`;
  if (!needsTranslation(source)) return order;

  try {
    const title = order.title ? await translateText(env, order.title) : order.title;
    let description = order.description;
    if (description) {
      const head = description.slice(0, MAX_DESCRIPTION_CHARS);
      description = await translateText(env, head);
      if (order.description.length > MAX_DESCRIPTION_CHARS) description += ' …';
    }
    return { ...order, title, description, title_original: order.title, translated: true };
  } catch (err) {
    // Перевод — удобство, а не условие доставки. Ошибку показываем в логе.
    console.error('translate failed', order.source_id, order.external_id, err.message);
    return { ...order, translate_error: err.message };
  }
}

export async function translateAll(env, orders) {
  const out = [];
  for (const order of orders) out.push(await translateOrder(env, order));
  return out;
}
