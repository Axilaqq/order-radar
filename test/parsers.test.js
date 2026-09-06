import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRss, extractBudget } from '../src/sources/rss.js';
import { parseFreelancehunt } from '../src/sources/freelancehunt.js';
import { parseTelegram } from '../src/sources/telegram.js';
import { parseInfostart } from '../src/sources/infostart.js';
import { parseRemoteOk } from '../src/sources/remoteok.js';
import { parseJobicy } from '../src/sources/jobicy.js';
import { parseArbeitnow } from '../src/sources/arbeitnow.js';
import { score } from '../src/filter.js';
import { looksUkrainian } from '../src/language.js';

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
  const [target, coursework, fence] = items.map((o) => score(o));
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
  // Служебные строки лежат отдельно и в оценку не попадают.
  assert.ok(!items[0].description.includes('Конфигурации'), 'конфигурации не должны быть в описании');
  assert.match(items[0].extra, /Конфигурации: 1С:Управление нашей фирмой 3\.0/);
  assert.match(items[0].extra, /Откликов: 7/);
  assert.equal(items[0].published_at, '2026-08-31T13:36:54.000Z');
});

test('Инфостарт: бюджет 0 отдаётся как null, а не как ноль рублей', () => {
  const items = parseInfostart(JSON.parse(read('infostart.json')), { id: 'infostart' });
  assert.equal(items[1].budget, null);
});

test('Инфостарт: правило «1С» выключено, проходит только то, что реально различает', () => {
  const src = { id: 'infostart', ignoreRules: ['1c'] };
  const items = parseInfostart(JSON.parse(read('infostart.json')), src);
  const [rec, excel, course] = items.map((o) => score(o, src));

  // «Разработать документ Рекламация» — про 1С, но ничего из нашего профиля.
  // Раньше проходил с баллом 5 просто за слово «1С». Теперь нет.
  assert.equal(rec.passed, false, 'заказ без признаков профиля не должен проходить');

  // Выгрузка прайса из Excel в УТ — профильная работа, проходит.
  assert.equal(excel.passed, true, 'выгрузка прайса из Excel должна проходить');
  assert.ok(excel.tags.includes('таблицы'));

  assert.equal(course.reason, 'stop-word');
});

test('Фильтр: ignoreRules выключает конкретное правило, остальные работают', () => {
  const order = { title: 'Доработка 1С и выгрузка в Ozon', description: '' };
  const withAll = score(order);
  const without1c = score(order, { ignoreRules: ['1c'] });
  assert.ok(withAll.score > without1c.score, 'без правила 1С балл должен быть ниже');
  assert.ok(without1c.tags.includes('маркетплейсы'), 'остальные правила продолжают работать');
});

test('Язык: украинские объявления распознаются, русские и английские — нет', () => {
  // Здесь нет ни і, ні ї — ловится по корню «розроб».
  assert.equal(looksUkrainian('Розробка дизайну етикетки для шкарпеток'), true);
  assert.equal(looksUkrainian('Потрібен фармацевт-консультант для перевірки текстів'), true);
  // Заголовок без характерных букв ловится вместе с описанием — так фильтр и работает.
  assert.equal(looksUkrainian('BLENDER модулюваня\nПотрібно зробити модель'), true);

  assert.equal(looksUkrainian('Настройка аудио в Remote Desktop на Windows Server'), false);
  assert.equal(looksUkrainian('Доработка 1С:УНФ — выгрузка остатков в Ozon'), false);
  assert.equal(looksUkrainian('Freelance Translators Needed'), false);
  assert.equal(looksUkrainian(''), false);
});

test('Язык: одна украинская буква в русском тексте не отбрасывает заказ', () => {
  const ru = 'Нужна интеграция 1С с маркетплейсом, склад в городе Київ, выгрузка цен';
  assert.equal(looksUkrainian(ru), false, 'перевес русских букв должен победить');
  assert.equal(score({ title: ru, description: '' }).passed, true);
});

test('Фильтр: украинский заказ не проходит с причиной ukrainian', () => {
  const r = score({ title: 'Інтеграція 1С з маркетплейсом', description: 'Потрібна вигрузка цін' });
  assert.equal(r.passed, false);
  assert.equal(r.reason, 'ukrainian');
  assert.equal(r.score, 0);
});

test('RemoteOK: пропускает юридическую заметку и разбирает вакансии', () => {
  const items = parseRemoteOk(JSON.parse(read('remoteok.json')), { id: 'remoteok' });
  assert.equal(items.length, 2, 'нулевой элемент-заметка не должен попасть в заказы');
  assert.equal(items[0].external_id, '1137307');
  assert.equal(items[0].title, 'Acme — Automation Engineer (Zapier / n8n)');
  assert.equal(items[0].budget, '60000–90000 USD/год');
  assert.equal(items[0].published_at, '2026-09-04T15:13:46.000Z');
});

test('RemoteOK: английский фильтр пропускает автоматизацию и режет крипто-аналитика', () => {
  const src = { id: 'remoteok', minScore: 5 };
  const [automation, crypto] = parseRemoteOk(JSON.parse(read('remoteok.json')), src).map((o) => score(o, src));
  assert.equal(automation.passed, true);
  assert.ok(automation.tags.includes('automation'));
  assert.equal(crypto.passed, false, 'крипто-трейдер не наш профиль');
});

test('Jobicy: разбирает вакансии и зарплату', () => {
  const src = { id: 'jobicy', minScore: 5 };
  const items = parseJobicy(JSON.parse(read('jobicy.json')), src);
  assert.equal(items.length, 2);
  assert.equal(items[0].budget, '102500–140000 USD/год');
  assert.match(items[0].description, /География: USA/);
  const [integration, office] = items.map((o) => score(o, src));
  assert.equal(integration.passed, true);
  assert.equal(office.passed, false, 'офис-менеджер не должен проходить');
  assert.equal(items[1].budget, null, 'нулевая зарплата — это null, а не 0');
});

test('Arbeitnow: unix-время переводится в дату, remote попадает в описание', () => {
  const src = { id: 'arbeitnow', minScore: 5 };
  const items = parseArbeitnow(JSON.parse(read('arbeitnow.json')), src);
  assert.equal(items.length, 2);
  assert.equal(items[0].published_at, new Date(1788695715 * 1000).toISOString());
  assert.match(items[0].description, /Удалённо: да/);
  assert.match(items[1].description, /Удалённо: нет/);
  assert.equal(items[0].budget, null, 'фид не отдаёт зарплату');
  const [dev, waiter] = items.map((o) => score(o, src));
  assert.equal(dev.passed, true);
  assert.equal(waiter.passed, false);
});

test('Порог источника переопределяет общий MIN_SCORE', () => {
  const order = { title: 'CRM integration', description: '' };
  const s = score(order);
  assert.equal(s.passed, true, 'при общем пороге 3 проходит');
  assert.equal(score(order, { minScore: s.score + 1 }).passed, false, 'при пороге выше балла — нет');
  assert.equal(score(order, { minScore: s.score }).passed, true, 'ровно на пороге — проходит');
});
