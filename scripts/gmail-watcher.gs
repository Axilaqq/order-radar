/**
 * Сборщик писем с фриланс-площадок для Order Radar.
 *
 * Что делает: раз в несколько минут смотрит почту, находит непрочитанные
 * письма от площадок и отдаёт их воркеру. Воркер решает, что переслать
 * в Telegram, и присылает обратно список обработанных писем — только им
 * скрипт ставит метку, чтобы не слать одно и то же дважды.
 *
 * Почему так, а не напрямую из воркера: чтобы воркер сам читал Gmail, нужен
 * проект в Google Cloud, экран согласия и refresh-токен, который в режиме
 * «тестирование» протухает каждые 7 дней. Этот скрипт живёт внутри вашего
 * же аккаунта Google и работает от вашего имени — ни токенов, ни настройки.
 *
 * УСТАНОВКА — см. README, раздел «Уведомления о сообщениях с площадок».
 * Коротко: script.google.com → новый проект → вставить этот файл →
 * задать WORKER_URL и INBOX_SECRET в «Свойствах скрипта» →
 * запустить collectOnce вручную (Google попросит разрешение) →
 * запустить installTrigger, чтобы повесить расписание.
 */

// Метка, которой помечаются обработанные письма. Пока метки нет,
// письмо считается новым; метку ставит только успешная отправка.
var LABEL_NAME = 'OrderRadar/Обработано';

// Отправители, за которыми следим. Добавляйте домены по мере регистрации
// на новых площадках — менять больше ничего не нужно.
var SENDERS = [
  'kwork.ru',
  'fl.ru',
  'free-lance.ru',
  'weblancer.net',
  'workspace.ru',
  'infostart.ru',
  'freelance.ru',
  'career.habr.com',
  'upwork.com',
  'freelancer.com'
];

// Сколько писем забирать за один проход. Запас на случай простоя.
var BATCH = 25;

function collectOnce() {
  var props = PropertiesService.getScriptProperties();
  var workerUrl = props.getProperty('WORKER_URL');
  var secret = props.getProperty('INBOX_SECRET');
  if (!workerUrl || !secret) {
    throw new Error('Задайте WORKER_URL и INBOX_SECRET в свойствах скрипта');
  }

  var label = GmailApp.getUserLabelByName(LABEL_NAME) || GmailApp.createLabel(LABEL_NAME);

  var query = '(' + SENDERS.map(function (d) { return 'from:' + d; }).join(' OR ') + ')'
    + ' -label:"' + LABEL_NAME + '" newer_than:2d';

  var threads = GmailApp.search(query, 0, BATCH);
  if (!threads.length) {
    Logger.log('новых писем нет');
    return;
  }

  var messages = [];
  var byId = {};
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      var id = msg.getId();
      byId[id] = thread;
      messages.push({
        id: id,
        from: msg.getFrom(),
        subject: msg.getSubject(),
        date: msg.getDate().toISOString(),
        // Тело режем: воркеру нужен смысл письма, а не подвал с картинками.
        body: msg.getPlainBody().slice(0, 4000)
      });
    });
  });

  var res = UrlFetchApp.fetch(workerUrl.replace(/\/$/, '') + '/inbox', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Inbox-Secret': secret },
    payload: JSON.stringify({ messages: messages }),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    // Метку не ставим: на следующем проходе письма поедут снова.
    throw new Error('воркер ответил ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  }

  var handled = (JSON.parse(res.getContentText()).handled) || [];
  var marked = {};
  handled.forEach(function (id) {
    var thread = byId[id];
    if (thread && !marked[thread.getId()]) {
      thread.addLabel(label);
      marked[thread.getId()] = true;
    }
  });

  Logger.log('отдано писем: ' + messages.length + ', обработано: ' + handled.length);
}

/** Разовая настройка: ставит триггер на каждые 5 минут. Запустить один раз. */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'collectOnce') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('collectOnce').timeBased().everyMinutes(5).create();
  Logger.log('триггер поставлен: каждые 5 минут');
}
