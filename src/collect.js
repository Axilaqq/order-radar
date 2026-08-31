import { SOURCES } from '../config/sources.js';
import { parseRss } from './sources/rss.js';
import { parseFreelancehunt } from './sources/freelancehunt.js';
import { parseTelegram } from './sources/telegram.js';
import { parseInfostart } from './sources/infostart.js';
import { score } from './filter.js';
import { db } from './db.js';
import { notify } from './telegram.js';

const UA = 'order-radar/1.0';
// Источники, отвечающие JSON. Остальные разбираются как текст (RSS, HTML).
const JSON_SOURCES = new Set(['freelancehunt', 'infostart']);
const FETCH_TIMEOUT_MS = 12000;

async function fetchSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: JSON_SOURCES.has(source.kind) ? 'application/json' : '*/*' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return JSON_SOURCES.has(source.kind) ? await res.json() : await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parse(payload, source) {
  if (source.kind === 'freelancehunt') return parseFreelancehunt(payload, source);
  if (source.kind === 'infostart') return parseInfostart(payload, source);
  if (source.kind === 'telegram') return parseTelegram(payload, source);
  return parseRss(payload, source);
}

export async function run(env, { dryRun = false } = {}) {
  const store = db(env);
  const startedAt = new Date().toISOString();
  const report = { started_at: startedAt, sources: [], new_orders: 0, notified: 0, errors: [] };

  const paused = await store.getSetting('paused', false).catch(() => false);

  for (const source of SOURCES.filter((s) => s.enabled)) {
    const entry = { id: source.id, fetched: 0, new: 0, passed: 0, error: null };
    try {
      const payload = await fetchSource(source);
      const parsed = parse(payload, source);
      entry.fetched = parsed.length;

      const rows = parsed.map((order) => {
        const s = score(order);
        return { ...order, score: s.score, tags: s.tags, status: s.passed ? 'new' : 'skipped', raw: null };
      });

      const inserted = dryRun ? [] : await store.insertNew(rows);
      entry.new = inserted.length;

      const toSend = inserted.filter((o) => o.status === 'new');
      entry.passed = toSend.length;
      report.new_orders += inserted.length;

      if (toSend.length && !paused) {
        const sentIds = await notify(env, toSend);
        await store.markSent(sentIds);
        report.notified += sentIds.length;
      }
    } catch (err) {
      entry.error = err.message;
      report.errors.push(`${source.id}: ${err.message}`);
      console.error('source failed', source.id, err.message);
    }
    report.sources.push(entry);
  }

  report.finished_at = new Date().toISOString();
  if (!dryRun) {
    await store.logRun({
      started_at: startedAt,
      finished_at: report.finished_at,
      new_orders: report.new_orders,
      notified: report.notified,
      errors: report.errors.length ? report.errors.join(' | ') : null,
    }).catch((e) => console.error('logRun failed', e.message));
  }
  return report;
}
