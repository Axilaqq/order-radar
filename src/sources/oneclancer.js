import { parseRss } from './rss.js';

// 1Clancer — биржа разовых заданий по 1С. HTML списка зависает:
// после первой порции Realplexor держит соединение открытым, и обычный
// fetch с таймаутом падает, не отдав тело. RSS «Задания» площадка сама
// рекламирует на https://1clancer.ru/rss/ — это и есть машинный доступ.
//
// Файл ленты лежит в /i/pics/rss/main.xml. robots.txt закрывает /i/
// (картинки и статика); страницу /rss/ не закрывает. Берём рекламируемую
// ленту, HTML не разбираем.
//
// Ссылки в ленте ведут на /offer/taskId=N (форма отклика). В уведомлении
// нужнее страница задания /task/N.

export function parseOneclancer(xml, source) {
  return parseRss(xml, source).map((order) => {
    const id = String(order.url || order.external_id || '').match(/taskId=(\d+)/i)?.[1]
      || String(order.url || '').match(/\/task\/(\d+)/)?.[1];
    if (!id) return null;
    return {
      ...order,
      external_id: id,
      url: `https://1clancer.ru/task/${id}`,
    };
  }).filter(Boolean);
}
