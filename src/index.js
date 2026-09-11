import { run } from './collect.js';
import { db } from './db.js';
import { sendMessage, notifyMail } from './telegram.js';
import { mailToEvent } from './mail.js';
import { SOURCES } from '../config/sources.js';
import { MIN_SCORE } from './filter.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function handleCommand(env, text) {
  const store = db(env);
  const cmd = text.trim().split(/\s+/)[0].toLowerCase();

  if (cmd === '/start' || cmd === '/help') {
    return [
      '<b>Order Radar</b> — два канала:',
      '• находит подходящие заказы на площадках;',
      '• присылает сообщения, которые вам написали на биржах (через почту).',
      '',
      '/stats — сколько заказов найдено за 24 часа',
      '/last — последние 10 находок',
      '/sources — какие площадки опрашиваются',
      '/pause — остановить уведомления',
      '/resume — включить обратно',
      '/run — опросить площадки прямо сейчас',
    ].join('\n');
  }

  if (cmd === '/stats') {
    const s = await store.statsLast24h();
    const lines = [`<b>За 24 часа найдено:</b> ${s.total}`];
    for (const [id, v] of Object.entries(s.bySource)) lines.push(`• ${id}: ${v.total} (отправлено ${v.sent})`);
    const paused = await store.getSetting('paused', false);
    lines.push('', paused ? '⏸ уведомления на паузе' : '▶️ уведомления включены');
    return lines.join('\n');
  }

  if (cmd === '/last') {
    const rows = await store.recent(10);
    if (!rows.length) return 'Пока пусто.';
    return rows.map((r) => `• <a href="${r.url}">${r.title}</a> — ⭐${r.score} ${r.budget || ''}`).join('\n');
  }

  if (cmd === '/sources') {
    return SOURCES.map((s) => `${s.enabled ? '✅' : '⛔️'} <b>${s.label}</b>\n<i>${s.status}</i>`).join('\n\n')
      + `\n\nПорог балла: ${MIN_SCORE}`;
  }

  if (cmd === '/pause') { await store.setSetting('paused', true); return '⏸ Уведомления остановлены.'; }
  if (cmd === '/resume') { await store.setSetting('paused', false); return '▶️ Уведомления включены.'; }

  if (cmd === '/run') {
    const report = await run(env);
    return `Опрошено источников: ${report.sources.length}\nНовых: ${report.new_orders}\nОтправлено: ${report.notified}`
      + (report.errors.length ? `\n\n⚠️ Ошибки:\n${report.errors.join('\n')}` : '');
  }

  return 'Не знаю такую команду. /help';
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({ ok: true, ts: new Date().toISOString(), sources: SOURCES.filter((s) => s.enabled).length });
    }

    if (url.pathname === '/run') {
      if (!env.RUN_KEY || url.searchParams.get('key') !== env.RUN_KEY) return json({ error: 'forbidden' }, 403);
      return json(await run(env, { dryRun: url.searchParams.get('dry') === '1' }));
    }

    // Приём писем-уведомлений с площадок. Сюда стучится скрипт-сборщик
    // из Gmail (scripts/gmail-watcher.gs) — см. README.
    //
    // Секрет передаётся заголовком, а не в адресе: адреса попадают в логи
    // прокси и в историю браузера, заголовки — нет.
    if (url.pathname === '/inbox' && request.method === 'POST') {
      if (!env.INBOX_SECRET || request.headers.get('X-Inbox-Secret') !== env.INBOX_SECRET) {
        return json({ error: 'forbidden' }, 403);
      }
      const payload = await request.json().catch(() => null);
      const mails = Array.isArray(payload?.messages) ? payload.messages : [];

      const events = [];
      const skipped = [];
      for (const mail of mails) {
        const { kind, notify, event } = mailToEvent(mail);
        if (notify && event) events.push(event);
        else skipped.push({ id: mail.id || null, kind });
      }

      const paused = await db(env).getSetting('paused', false).catch(() => false);
      const sent = events.length && !paused ? await notifyMail(env, events) : [];

      // Скрипт помечает письмо обработанным только по списку handled —
      // если отправка сорвалась, письмо вернётся на следующем проходе.
      return json({
        received: mails.length,
        notified: sent.length,
        skipped: skipped.length,
        paused,
        handled: [...sent, ...skipped.map((s) => s.id)].filter(Boolean),
        kinds: skipped.reduce((acc, s) => ({ ...acc, [s.kind]: (acc[s.kind] || 0) + 1 }), {}),
      });
    }

    // Вебхук Telegram. Секрет в пути, чтобы посторонний не мог дёргать бота.
    if (env.TELEGRAM_WEBHOOK_SECRET && url.pathname === `/tg/${env.TELEGRAM_WEBHOOK_SECRET}`) {
      const update = await request.json().catch(() => null);
      const msg = update?.message;
      if (msg?.text && String(msg.chat?.id) === String(env.TELEGRAM_CHAT_ID)) {
        try {
          await sendMessage(env, await handleCommand(env, msg.text));
        } catch (err) {
          await sendMessage(env, `Ошибка: ${err.message}`.slice(0, 500)).catch(() => {});
        }
      }
      return new Response('ok');
    }

    return new Response('order-radar', { status: 200 });
  },
};
