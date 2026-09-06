import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWeblancer, parseDotDate } from '../src/sources/weblancer.js';
import { score } from '../src/filter.js';

const read = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const src = { id: 'weblancer' };

test('Weblancer: разбирает карточки заказов с реальной страницы', () => {
  const items = parseWeblancer(read('weblancer.html'), src);
  assert.equal(items.length, 3);

  const [drupal, bot, ai] = items;
  assert.equal(drupal.external_id, '1269185');
  assert.equal(drupal.title, 'Drupal 11 developer — технические SEO-доработки сайта');
  assert.equal(drupal.url, 'https://www.weblancer.net/freelance/jobs/drupal-11-developer-tekhnicheskie-seo-dorabotki-saita-1269185/');
  // «999<!-- --> $» — внутри бюджета пустой HTML-комментарий, его надо убрать.
  assert.equal(drupal.budget, '999 $');
  assert.equal(drupal.published_at, '2026-09-06T12:00:00.000Z');

  assert.equal(bot.external_id, '1269182');
  assert.equal(bot.budget, null, 'бюджет не указан — это null, а не пустая строка');
  assert.equal(ai.published_at, '2026-09-05T12:00:00.000Z');
});

test('Weblancer: заявки и просмотры лежат в extra и в оценку не входят', () => {
  const [drupal, bot, ai] = parseWeblancer(read('weblancer.html'), src);

  // «3 заявки» и «7 заявок» — общего куска «заявк» у них нет, поэтому корень «заяв».
  assert.match(drupal.extra, /Заявок: 3/);
  assert.match(bot.extra, /Заявок: 7/);
  assert.match(ai.extra, /Заявок: 7/);
  assert.match(drupal.extra, /Просмотров: 119/);
  assert.match(ai.extra, /Просмотров: 1321/);
  assert.match(drupal.extra, /Рубрики: Доработка сайтов, Оптимизация сайтов/);

  // Служебные строки не должны попадать в описание: оценка считается по нему.
  for (const o of [drupal, bot, ai]) {
    assert.ok(!o.description.includes('Заявок'), 'заявки не должны быть в описании');
    assert.ok(!o.description.includes('Рубрики'), 'рубрики не должны быть в описании');
  }
});

test('Weblancer: профильные заказы проходят фильтр', () => {
  const [drupal, bot, ai] = parseWeblancer(read('weblancer.html'), src).map((o) => ({ ...o, ...score(o, src) }));

  assert.equal(bot.passed, true, 'доработка Телеграм-бота — наш профиль');
  assert.ok(bot.tags.includes('TG-бот'));

  assert.equal(ai.passed, true, 'локальные LLM и агенты — наш профиль');
  assert.ok(ai.tags.includes('AI'));

  // SEO-доработки на Drupal — не наш профиль, балл должен быть ниже.
  assert.ok(ai.score > drupal.score, 'AI-заказ должен набрать больше, чем SEO на Drupal');
});

test('Weblancer: дата ДД.ММ.ГГГГ переводится в ISO, мусор даёт null', () => {
  assert.equal(parseDotDate('06.09.2026'), '2026-09-06T12:00:00.000Z');
  assert.equal(parseDotDate('01.01.2027'), '2027-01-01T12:00:00.000Z');
  assert.equal(parseDotDate('вчера'), null);
  assert.equal(parseDotDate('6.9.2026'), null, 'однозначные числа площадка не отдаёт');
  assert.equal(parseDotDate(''), null);
});

test('Weblancer: сломанная вёрстка даёт пустой список, а не падение', () => {
  assert.deepEqual(parseWeblancer('<div>совсем другая страница</div>', src), []);
  assert.deepEqual(parseWeblancer('', src), []);
  // Карточка без числового идентификатора в адресе пропускается.
  const noId = '<article><h2><a href="/freelance/jobs/bez-nomera/">Заголовок</a></h2></article>';
  assert.deepEqual(parseWeblancer(noId, src), []);
});
