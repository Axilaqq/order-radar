// Список площадок, которые опрашивает бот.
// kind — какой адаптер разбирает ответ: 'freelancehunt' | 'rss' | 'telegram'.
// enabled — включён ли источник. Выключенные не опрашиваются.
// status — честная пометка, насколько источник проверен на 31.08.2026.
export const SOURCES = [
  {
    id: 'freelancehunt',
    kind: 'freelancehunt',
    url: 'https://api.freelancehunt.com/v2/projects',
    label: 'Freelancehunt',
    enabled: true,
    status: 'ПРОВЕРЕНО 31.08.2026: JSON отдаётся без токена',
  },
  {
    id: 'freelancer_com',
    kind: 'rss',
    url: 'https://www.freelancer.com/rss.xml',
    label: 'Freelancer.com',
    enabled: true,
    status: 'ПРОВЕРЕНО 31.08.2026: валидный RSS',
  },
  {
    id: 'fl_ru',
    kind: 'rss',
    url: 'https://www.fl.ru/rss/all.xml',
    label: 'FL.ru',
    enabled: true,
    status: 'НЕ ПРОВЕРЕНО: robots.txt закрыл ленту для нашего инструмента проверки. Первый запуск покажет, отвечает ли она воркеру.',
  },
  {
    id: 'tg_freelancce',
    kind: 'telegram',
    url: 'https://t.me/s/freelancce',
    label: 'TG @freelancce',
    enabled: false,
    status: 'НЕ ПРОВЕРЕНО ПО СВЕЖЕСТИ: последние посты, которые мы увидели, — 02.07.2026. Включать после ручной проверки.',
  },
];

// Сколько символов описания тянуть в уведомление.
export const DESCRIPTION_LIMIT = 600;
