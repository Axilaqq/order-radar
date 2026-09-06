// Живая проверка площадок. Запускать локально: npm run check-sources
// Ходит по каждому включённому источнику, разбирает ответ и показывает,
// сколько заказов пришло и сколько прошло фильтр. Ничего никуда не пишет.
import { SOURCES } from '../config/sources.js';
import { parseRss } from '../src/sources/rss.js';
import { parseFreelancehunt } from '../src/sources/freelancehunt.js';
import { parseTelegram } from '../src/sources/telegram.js';
import { parseInfostart } from '../src/sources/infostart.js';
import { parseRemoteOk } from '../src/sources/remoteok.js';
import { parseJobicy } from '../src/sources/jobicy.js';
import { parseArbeitnow } from '../src/sources/arbeitnow.js';
import { parseWorkspace } from '../src/sources/workspace.js';
import { parseWeblancer } from '../src/sources/weblancer.js';
import { score } from '../src/filter.js';

const only = process.argv[2];
const list = SOURCES.filter((s) => (only ? s.id === only : s.enabled));

for (const source of list) {
  process.stdout.write(`\n=== ${source.label} (${source.id}) ===\n${source.url}\n`);
  try {
    const res = await fetch(source.url, { headers: { 'User-Agent': 'order-radar/1.0', ...(source.headers || {}) } });
    process.stdout.write(`HTTP ${res.status} ${res.headers.get('content-type') || ''}\n`);
    if (!res.ok) continue;

    // Один разбор на вид источника — чтобы не городить лесенку из тернарников.
    const JSON_KINDS = { freelancehunt: parseFreelancehunt, infostart: parseInfostart,
                         remoteok: parseRemoteOk, jobicy: parseJobicy, arbeitnow: parseArbeitnow };
    const TEXT_KINDS = { workspace: parseWorkspace, weblancer: parseWeblancer,
                         telegram: parseTelegram };
    const items = JSON_KINDS[source.kind]
      ? JSON_KINDS[source.kind](await res.json(), source)
      : (TEXT_KINDS[source.kind] || parseRss)(await res.text(), source);

    const scored = items.map((i) => ({ ...i, ...score(i, source) }));
    const passed = scored.filter((i) => i.passed);
    process.stdout.write(`разобрано: ${items.length}, прошло фильтр: ${passed.length} (порог ${source.minScore ?? 'общий'})\n`);
    for (const p of passed.slice(0, 5)) {
      process.stdout.write(`  ⭐${p.score} [${p.tags.join(',')}] ${p.title}\n      ${p.url}\n`);
    }
    if (!passed.length && scored.length) {
      process.stdout.write(`  (примеры того, что отсеялось: ${scored.slice(0, 3).map((s) => s.title.slice(0, 50)).join(' | ')})\n`);
    }
  } catch (err) {
    process.stdout.write(`ОШИБКА: ${err.message}\n`);
  }
}
