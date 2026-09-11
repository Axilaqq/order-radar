const API = 'https://api.telegram.org/bot';

function escapeHtml(s = '') {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendMessage(env, text, extra = {}) {
  const res = await fetch(`${API}${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!body.ok) throw new Error(`Telegram sendMessage failed: ${JSON.stringify(body).slice(0, 300)}`);
  return body.result;
}

const SOURCE_LABELS = {
  workspace: 'Workspace (тендеры)',
  infostart: 'Инфостарт (1С)',
  weblancer: 'Weblancer',
  remoteok: 'RemoteOK 🌍',
  jobicy: 'Jobicy 🌍',
  wwr: 'We Work Remotely 🌍',
  arbeitnow: 'Arbeitnow 🇪🇺',
  freelancehunt: 'Freelancehunt',
  freelancer_com: 'Freelancer.com',
  fl_ru: 'FL.ru',
};

export function formatOrder(order) {
  const lines = [];
  lines.push(`<b>${escapeHtml(order.title)}</b>`);
  const meta = [
    SOURCE_LABELS[order.source_id] || order.source_id,
    order.budget ? `💰 ${escapeHtml(order.budget)}` : '💰 не указан',
    `⭐ ${order.score}`,
  ];
  lines.push(meta.join(' · '));
  if (order.tags?.length) lines.push(`🏷 ${order.tags.map(escapeHtml).join(', ')}`);
  // Показываем, что текст переведён, и даём оригинал заголовка —
  // машинный перевод может исказить название технологии.
  if (order.title_original && order.title_original !== order.title) {
    lines.push(`🌐 перевод · оригинал: ${escapeHtml(order.title_original)}`);
  }
  if (order.description) lines.push('', escapeHtml(order.description.slice(0, 700)));
  if (order.url) lines.push('', order.url);
  return lines.join('\n');
}

// Уведомление о письме с площадки: заказчик написал или откликнулся.
// Выглядит иначе, чем находка заказа, — это не «посмотри вакансию»,
// а «тебе написали, надо ответить».
const MAIL_KIND_TITLE = {
  message: '✉️ Новое сообщение',
  order: '📌 Движение по заказу',
};

export function formatMailEvent(event) {
  const lines = [`<b>${MAIL_KIND_TITLE[event.kind] || '✉️ Уведомление'} · ${escapeHtml(event.platform)}</b>`];
  if (event.author) lines.push(`От: ${escapeHtml(event.author)}`);
  if (event.subject) lines.push(`<i>${escapeHtml(event.subject)}</i>`);
  if (event.text) lines.push('', escapeHtml(event.text.slice(0, 700)));
  if (event.url) lines.push('', `Ответить: ${event.url}`);
  return lines.join('\n');
}

export async function notifyMail(env, events) {
  const sent = [];
  for (const event of events) {
    try {
      await sendMessage(env, formatMailEvent(event));
      sent.push(event.id);
    } catch (err) {
      console.error('notifyMail failed', event.id, err.message);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return sent;
}

export async function notify(env, orders) {
  const sent = [];
  for (const order of orders) {
    try {
      await sendMessage(env, formatOrder(order));
      sent.push(order.id);
    } catch (err) {
      console.error('notify failed', order.id, err.message);
    }
    // Telegram ограничивает примерно 30 сообщений в секунду. Держим запас.
    await new Promise((r) => setTimeout(r, 120));
  }
  return sent;
}
