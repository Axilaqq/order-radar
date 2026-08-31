// Список площадок, которые опрашивает бот.
// kind — какой адаптер разбирает ответ: 'infostart' | 'freelancehunt' | 'rss' | 'telegram'.
// enabled — включён ли источник. Выключенные не опрашиваются.
// status — честная пометка, насколько источник проверен на 31.08.2026.
//
// Порядок важен: первым идёт та площадка, где спрос реально измерен и он профильный.
export const SOURCES = [
  {
    id: 'infostart',
    kind: 'infostart',
    url: 'https://infostart.ru/rest/v1/freelance/orders?limit=50',
    label: 'Инфостарт, Биржа заказов (1С)',
    enabled: true,
    status: 'ПРОВЕРЕНО 31.08.2026: REST отдаёт JSON без токена. 90 активных заказов, поток ~1/сутки, медиана бюджета 10 000 ₽, максимум 180 000 ₽, откликов в среднем 6. Комиссии нет, расчёты напрямую разрешены. Конфигурации: УТ 11, Бухгалтерия 3.0, УТ 10, УНФ 3.0, Розница.',
  },
  {
    id: 'freelancehunt',
    kind: 'freelancehunt',
    url: 'https://api.freelancehunt.com/v2/projects',
    label: 'Freelancehunt',
    enabled: true,
    status: 'ПРОВЕРЕНО 31.08.2026: JSON без токена. НО за 11 часов 60 проектов, ни одного по 1С, бюджеты в гривнах (медиана ~3000 UAH), откликов 9–27. Вывод средств из РФ — открытый вопрос. Держим как фон, не как основной источник.',
  },
  {
    id: 'freelancer_com',
    kind: 'rss',
    url: 'https://www.freelancer.com/rss.xml',
    label: 'Freelancer.com',
    enabled: false,
    status: 'ПРОВЕРЕНО 31.08.2026, ВЫКЛЮЧЕН: RSS валиден, но отдаёт лишь 20 последних проектов без категорий. Из 20 фильтр прошли 2, оба нецелевые. Как источник заказов бесполезен.',
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
