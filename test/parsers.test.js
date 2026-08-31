import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRss, extractBudget } from '../src/sources/rss.js';
import { parseFreelancehunt } from '../src/sources/freelancehunt.js';
import { parseTelegram } from '../src/sources/telegram.js';
import { parseInfostart } from '../src/sources/infostart.js';
import { score } from '../src/filter.js';

const read = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');

test('RSS: разбирает элементы, чистит CDATA и HTML', () => {
  const items = parseRss(read('rss.xml'), { id: 'fl_ru' });
  assert.equal(items.length, 3);
  assert.equal(items[0].title, 'Доработка 1С:УНФ — выгрузка остатков в Ozon');
  assert.equal(items[0].url, 'https://www.fl.ru/projects/111111/');
  assert.ok(!items[0].description.includes('<p>'));
  assert.equal(items[0].published_at, '2026-08-31T08:15:00.000Z');
});

test('RSS: вытаскивает бюджет', () => {
  assert.equal(extractBudget('Бюджет 45 000 руб.'), '45 000 руб');
  assert.equal(extractBudget('без цифр'), null);
});

test('Freelancehunt: разбирает JSON:API', () => {
  const items = parseFreelancehunt(JSON.parse(read('freelancehunt.json')), { id: 'freelancehunt' });
  assert.equal(items.length, 1);
  assert.equal(items[0].external_id, '1449234');
  assert.equal(items[0].budget, '1500 UAH');
  assert.match(items[0].description, /Навыки: 1С, Базы данных/);
  assert.equal(items[0].url, 'https://freelancehunt.com/project/skachat-obrabotku/1449234.html');
});

test('Telegram: разбирает превью канала', () => {
  const items = parseTelegram(read('telegram.html'), { id: 'tg', url: 'https://t.me/s/freelancce' });
  assert.equal(items.length, 2);
  assert.equal(items[0].external_id, 'freelancce/12345');
  assert.equal(items[0].url, 'https://t.me/freelancce/12345');
  assert.match(items[0].title, /Telegram-бот/);
  assert.equal(items[0].published_at, '2026-08-31T09:00:00.000Z');
});

test('Фильтр: профильный заказ проходит, курсовая и посторонний — нет', () => {
  const items = parseRss(read('rss.xml'), { id: 'fl_ru' });
  const [target, coursework, fence] = items.map(score);
  assert.equal(target.passed, true);
  assert.ok(target.score >= 8, `ожидали >=8, получили ${target.score}`);
  assert.deepEqual(coursework.reason, 'stop-word');
  assert.equal(fence.passed, false);
});

test('Фильтр: дедупликация тегов', () => {
  const r = score({ title: '1С 1С 1С', description: '1С:Предприятие' });
  assert.deepEqual(r.tags, ['1С']);
});

test('Инфостарт: разбирает REST-ответ биржи 1С', () => {
  const items = parseInfostart(JSON.parse(read('infostart.json')), { id: 'infostart' });
  assert.equal(items.length, 3);
  assert.equal(items[0].external_id, '2777230');
  assert.equal(items[0].url, 'https://infostart.ru/project/#/orders/2777230');
  assert.equal(items[0].budget, '5000 ₽');
  assert.match(items[0].description, /Конфигурации: 1С:Управление нашей фирмой 3\.0/);
  assert.match(items[0].description, /Откликов: 7/);
  assert.equal(items[0].published_at, '2026-08-31T13:36:54.000Z');
});

test('Инфостарт: бюджет 0 отдаётся как null, а не как ноль рублей', () => {
  const items = parseInfostart(JSON.parse(read('infostart.json')), { id: 'infostart' });
  assert.equal(items[1].budget, null);
});

test('Инфостарт: профильный заказ проходит фильтр, курсовая отсекается', () => {
  const items = parseInfostart(JSON.parse(read('infostart.json')), { id: 'infostart' });
  const [rec, excel, course] = items.map(score);
  assert.equal(rec.passed, true, 'заказ по УНФ должен проходить');
  assert.equal(excel.passed, true, 'выгрузка прайса из Excel в УТ должна проходить');
  assert.equal(course.reason, 'stop-word');
});
