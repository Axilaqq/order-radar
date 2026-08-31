import { run } from './collect.js';
import { db } from './db.js';
import { sendMessage } from './telegram.js';
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
      '<b>Order Radar</b> — собирает заказы с площадок и присылает подходящие.',
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
