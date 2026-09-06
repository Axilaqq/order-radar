import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsTranslation, translateOrder, translateAll } from '../src/translate.js';

// Подставная привязка Workers AI: считает вызовы и возвращает предсказуемый
// результат. Сеть не трогаем — проверяем нашу логику, а не чужую модель.
function fakeAI(reply = (t) => `[ru] ${t}`) {
  const calls = [];
  return {
    calls,
    AI: {
      async run(model, input) {
        calls.push({ model, input });
        return { translated_text: reply(input.text) };
      },
    },
  };
}

test('Перевод: английский текст нужно переводить, русский — нет', () => {
  assert.equal(needsTranslation('Looking for a freelance AI Engineer for a trading project'), true);
  assert.equal(needsTranslation('Experienced Full Stack Engineer for Scalable Web Applications'), true);

  // Русский заказ с латинскими вкраплениями переводить не надо.
  assert.equal(needsTranslation('Доработка 1С:УНФ — выгрузка остатков в Ozon через API'), false);
  assert.equal(needsTranslation('Настройка amoCRM и вебхуков'), false);

  // Слишком мало латиницы, чтобы считать это текстом на другом языке.
  assert.equal(needsTranslation('CRM'), false);
  assert.equal(needsTranslation(''), false);
});

test('Перевод: английский заказ переводится, оригинал заголовка сохраняется', async () => {
  const env = fakeAI();
  const order = {
    source_id: 'remoteok',
    external_id: '1',
    title: 'Automation Engineer for data pipeline',
    description: 'We need a contractor to build integrations between our CRM and warehouse.',
  };
  const out = await translateOrder(env, order);

  assert.equal(out.translated, true);
  assert.equal(out.title, '[ru] Automation Engineer for data pipeline');
  assert.equal(out.title_original, 'Automation Engineer for data pipeline');
  assert.match(out.description, /^\[ru\] We need a contractor/);
  assert.equal(env.calls.length, 2, 'заголовок и описание — два вызова');
  assert.equal(env.calls[0].model, '@cf/meta/m2m100-1.2b');
  assert.equal(env.calls[0].input.target_lang, 'russian');
});

test('Перевод: русский заказ модель не дёргает', async () => {
  const env = fakeAI();
  const order = { title: 'Доработка 1С:УНФ', description: 'Выгрузка остатков в Ozon' };
  const out = await translateOrder(env, order);

  assert.equal(env.calls.length, 0, 'лишних вызовов модели быть не должно');
  assert.equal(out.title, 'Доработка 1С:УНФ');
  assert.equal(out.translated, undefined);
});

test('Перевод: без привязки AI заказ уходит как есть, без падения', async () => {
  const order = { title: 'Automation Engineer', description: 'Build data pipelines and webhooks' };
  assert.deepEqual(await translateOrder({}, order), order);
  assert.deepEqual(await translateOrder(undefined, order), order);
});

test('Перевод: ошибка модели не отменяет уведомление', async () => {
  const env = { AI: { async run() { throw new Error('quota exceeded'); } } };
  const order = { title: 'Automation Engineer', description: 'Build data pipelines and webhooks' };
  const out = await translateOrder(env, order);

  assert.equal(out.title, 'Automation Engineer', 'оригинал должен остаться');
  assert.equal(out.translated, undefined);
  assert.equal(out.translate_error, 'quota exceeded');
});

test('Перевод: пустой ответ модели считается ошибкой', async () => {
  const env = { AI: { async run() { return { translated_text: '   ' }; } } };
  const out = await translateOrder(env, { title: 'Data pipeline engineer needed', description: '' });
  assert.equal(out.title, 'Data pipeline engineer needed');
  assert.match(out.translate_error, /пустой ответ/);
});

test('Перевод: длинное описание режется, а в конец ставится многоточие', async () => {
  const env = fakeAI((t) => `[ru] ${t}`);
  const long = 'a'.repeat(2000);
  const out = await translateOrder(env, { title: 'Long automation project', description: long });
  assert.ok(env.calls[1].input.text.length <= 900, 'в модель уходит обрезанный текст');
  assert.match(out.description, / …$/);
});

test('Перевод: список обрабатывается целиком, смешанный из русских и английских', async () => {
  const env = fakeAI();
  const out = await translateAll(env, [
    { title: 'Доработка 1С', description: 'выгрузка в Ozon' },
    { title: 'Integration Engineer for webhooks', description: 'Connect Stripe and HubSpot' },
  ]);
  assert.equal(out[0].translated, undefined);
  assert.equal(out[1].translated, true);
  assert.equal(env.calls.length, 2, 'русский заказ модель не трогает');
});
