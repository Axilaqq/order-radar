import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyMail, mailToEvent, extractAuthor, extractText, extractLink, detectPlatform } from '../src/mail.js';
import { formatMailEvent } from '../src/telegram.js';

// Настоящее письмо Kwork от 01.09.2026, как его отдаёт Gmail в plain text.
const KWORK_MESSAGE = [
  ' Получено новое сообщение',
  '',
  '| |',
  '| [](https://kwork.ru?utm_content=logo&utm_tokent16383d) | перейти на kwork.ru[](https://kwork.ru) |',
  '',
  '| |',
  '| Получено новое сообщение | |',
  '',
  'от службы поддержки',
  '',
  '*На вашем аватаре или в шапке профиля обнаружены контактные данные, поэтому изображение скрыто от других пользователей.*',
  '',
  '| Ответить на сайте[](https://kwork.ru/inbox/support) |',
  '',
  '| Если вы не хотите получать письма от нас, отписаться[](https://kwork.ru/unsubscribe/7416383d/do) |',
].join('\n');

test('Почта: коды и вход в аккаунт НИКОГДА не пересылаются', () => {
  // Разовый код в Telegram — это готовый ключ от аккаунта. Правило жёсткое.
  const secrets = [
    '[Хабр Аккаунт] Проверочный код',
    '[Хабр Аккаунт] Регистрация',
    'Подтверждение электронной почты',
    'Вход в аккаунт с нового устройства/места',
    'К аккаунту привязан номер телефона',
    'Последний день для активации аккаунта',
    'Reset your password',
    'New sign-in from Chrome',
  ];
  for (const subject of secrets) {
    const r = classifyMail({ subject, from: 'info@kwork.ru' });
    assert.equal(r.notify, false, `«${subject}» не должно уходить в Telegram`);
  }
  // И даже если тело письма выглядит как личное сообщение — тема решает.
  const r = mailToEvent({ subject: 'Проверочный код', from: 'account@habr.com', body: 'от Иван\n\n*привет*' });
  assert.equal(r.event, null);
});

test('Почта: дайджесты и рассылки молчат — заказы мы собираем напрямую', () => {
  const noise = [
    'Новые проекты на бирже Kwork',
    'Привет, это Хабр Карьера! Как сделать так, чтобы вас хантили?',
    'Привет, это Хабр Карьера! Коротко о главном',
    'Привет, это Хабр Карьера! Рассказываем о нашем сервисе подробнее',
  ];
  for (const subject of noise) {
    assert.equal(classifyMail({ subject, from: 'news@kwork.ru' }).notify, false, subject);
  }
});

test('Почта: личные сообщения и движение по заказу пересылаются', () => {
  const wanted = [
    ['Новое сообщение на Kwork.ru', 'message'],
    ['Вам написал заказчик', 'message'],
    ['You have a new message from Acme', 'message'],
    ['Новый отклик на ваш проект', 'order'],
    ['Вас пригласили в проект', 'order'],
    ['Заказ № 4512 оплачен', 'order'],
  ];
  for (const [subject, kind] of wanted) {
    const r = classifyMail({ subject, from: 'news@kwork.ru' });
    assert.equal(r.notify, true, subject);
    assert.equal(r.kind, kind, subject);
  }
});

test('Почта: русские окончания ловятся — \\w в JS кириллицу не берёт', () => {
  // Ровно та ошибка, на которой правила молчали в первой версии.
  assert.equal(classifyMail({ subject: 'Новое сообщение', from: 'x@kwork.ru' }).kind, 'message');
  assert.equal(classifyMail({ subject: 'Новые сообщения', from: 'x@kwork.ru' }).kind, 'message');
  assert.equal(classifyMail({ subject: 'Новый заказ', from: 'x@kwork.ru' }).kind, 'order');
});

test('Почта: площадка определяется по отправителю', () => {
  assert.equal(detectPlatform('news@kwork.ru').label, 'Kwork');
  assert.equal(detectPlatform('no_reply@free-lance.ru').label, 'FL.ru');
  assert.equal(detectPlatform('noreply@career.habr.com').label, 'Хабр Карьера');
  assert.equal(detectPlatform('robot@nekayaploshadka.com').id, 'other');
});

test('Почта: из настоящего письма Kwork вынимаются автор, текст и ссылка на ответ', () => {
  const { kind, notify, event } = mailToEvent({
    id: 'msg-1', from: 'news@kwork.ru', subject: 'Новое сообщение на Kwork.ru',
    body: KWORK_MESSAGE, date: '2026-09-01T07:51:54Z',
  });

  assert.equal(notify, true);
  assert.equal(kind, 'message');
  assert.equal(event.platform, 'Kwork');
  assert.equal(event.author, 'службы поддержки');
  assert.match(event.text, /^На вашем аватаре/);
  // Пустые markdown-ссылки «текст[](адрес)» из тела должны исчезнуть.
  assert.ok(!event.text.includes('[]('), 'мусор разметки не должен попадать в текст');
  // Ссылка — именно на переписку, а не на логотип и не на отписку.
  assert.equal(event.url, 'https://kwork.ru/inbox/support');
});

test('Почта: ссылки на логотип, отписку и магазины приложений отбрасываются', () => {
  const body = [
    '[](https://kwork.ru?utm_content=logo&utm_token=1)',
    'https://apps.apple.com/ru/app/kwork/id1456387980',
    'https://play.google.com/store/apps/details?id=ru.kwork.app',
    'https://kwork.ru/unsubscribe/abc/do',
    'https://kwork.ru/inbox/9911',
  ].join('\n');
  assert.equal(extractLink(body), 'https://kwork.ru/inbox/9911');
  assert.equal(extractLink('без ссылок вовсе'), null);
});

test('Почта: автор и текст отсутствуют — событие всё равно собирается', () => {
  const { event } = mailToEvent({ id: 'm', from: 'x@weblancer.net', subject: 'Новый отклик на ваш проект', body: '' });
  assert.equal(event.author, null);
  assert.equal(event.text, null);
  assert.equal(event.url, null);
  assert.equal(event.platform, 'Weblancer');
});

test('Почта: уведомление в Telegram собирается читаемо', () => {
  const { event } = mailToEvent({
    id: 'm2', from: 'news@kwork.ru', subject: 'Новое сообщение на Kwork.ru',
    body: 'от Иван Петров\n\n*Здравствуйте! Интересует доработка бота.*\n\n| Ответить[](https://kwork.ru/inbox/12345) |',
  });
  const text = formatMailEvent(event);

  assert.match(text, /✉️ Новое сообщение · Kwork/);
  assert.match(text, /От: Иван Петров/);
  assert.match(text, /Интересует доработка бота/);
  assert.match(text, /Ответить: https:\/\/kwork\.ru\/inbox\/12345/);
});

test('Почта: угловые скобки в письме экранируются, чтобы Telegram не сломался', () => {
  const { event } = mailToEvent({
    id: 'm3', from: 'news@kwork.ru', subject: 'Новое сообщение на Kwork.ru',
    body: 'от <script>alert(1)</script>\n\n*Текст с <b> и & внутри, достаточно длинный для абзаца.*',
  });
  const text = formatMailEvent(event);
  assert.ok(!text.includes('<script>'), 'сырые теги не должны попадать в сообщение');
  assert.match(text, /&lt;script&gt;/);
});
