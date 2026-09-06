// Список площадок, которые опрашивает бот.
// kind — адаптер: 'infostart' | 'remoteok' | 'jobicy' | 'arbeitnow' | 'freelancehunt' | 'rss' | 'telegram'.
// region — для кого площадка: 'ru' | 'west'. Влияет только на читаемость конфига.
// enabled — включён ли источник.
// ignoreRules — id правил из config/keywords.js, которые здесь ничего не различают.
// minScore — свой порог вместо общего MIN_SCORE.
// headers — дополнительные заголовки запроса.
// status — честная пометка: что проверено, когда и с каким результатом.
export const SOURCES = [
  // ────────────────────────────── Россия ──────────────────────────────
  {
    id: 'infostart',
    kind: 'infostart',
    region: 'ru',
    url: 'https://infostart.ru/rest/v1/freelance/orders?limit=25',
    label: 'Инфостарт, Биржа заказов (1С)',
    enabled: true,
    ignoreRules: ['1c'],
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept-Language': 'ru-RU,ru;q=0.9',
    },
    status: 'ПРОВЕРЕНО: REST без токена, работает третьи сутки. ~1 заказ/сутки, медиана 10 000 ₽, откликов 6, комиссии нет, расчёты напрямую. Профильность 62%.',
  },

  // ────────────────────── Запад: удалённая работа ──────────────────────
  // Это ВАКАНСИИ, а не разовые заказы: другой цикл найма и открытый вопрос
  // с получением оплаты из РФ. Порог поднят — поток на порядок больше и шумнее.
  {
    id: 'remoteok',
    kind: 'remoteok',
    region: 'west',
    url: 'https://remoteok.com/api',
    label: 'RemoteOK',
    enabled: true,
    minScore: 5,
    status: 'ПРОВЕРЕНО: JSON без авторизации, ~25 свежих вакансий, есть salary_min/max в USD. Нулевой элемент массива — юридическая заметка, адаптер её пропускает.',
  },
  {
    id: 'jobicy',
    kind: 'jobicy',
    region: 'west',
    url: 'https://jobicy.com/api/v2/remote-jobs?count=50&tag=developer',
    label: 'Jobicy',
    enabled: true,
    minScore: 5,
    status: 'ПРОВЕРЕНО: JSON без авторизации, есть annualSalaryMin/Max и jobGeo (US/EU). Площадка просит вести ссылку на оригинал вакансии — адаптер так и делает.',
  },
  {
    id: 'wwr',
    kind: 'rss',
    region: 'west',
    url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss',
    label: 'We Work Remotely',
    enabled: true,
    minScore: 5,
    status: 'ПРОВЕРЕНО: валидный RSS, 15 последних вакансий по программированию. Зарплата в ленте не приходит.',
  },
  {
    id: 'arbeitnow',
    kind: 'arbeitnow',
    region: 'west',
    url: 'https://www.arbeitnow.com/api/job-board-api',
    label: 'Arbeitnow (Европа)',
    enabled: true,
    minScore: 5,
    status: 'ПРОВЕРЕНО: JSON без авторизации. Преимущественно Германия и Западная Европа, много офисных позиций — поле remote показывает, удалённая ли вакансия. Зарплату фид не отдаёт.',
  },

  // ──────────────────────────── Выключено ────────────────────────────
  {
    id: 'freelancehunt',
    kind: 'freelancehunt',
    region: 'ua',
    url: 'https://api.freelancehunt.com/v2/projects',
    label: 'Freelancehunt',
    enabled: false,
    status: 'ВЫКЛЮЧЕН по решению владельца: площадка рассчитана на Украину. 60% объявлений на украинском, из оставшихся профильных единицы, бюджеты в гривнах, вывод средств из РФ не решён. API рабочий — если понадобится, включается одной строкой.',
  },
  {
    id: 'freelancer_com',
    kind: 'rss',
    region: 'west',
    url: 'https://www.freelancer.com/rss.xml',
    label: 'Freelancer.com',
    enabled: false,
    status: 'ПРОВЕРЕНО, ВЫКЛЮЧЕН: RSS отдаёт лишь 20 последних проектов без категорий. Из 20 фильтр прошли 2, оба нецелевые.',
  },
  {
    id: 'fl_ru',
    kind: 'rss',
    region: 'ru',
    url: 'https://www.fl.ru/rss/all.xml',
    label: 'FL.ru',
    enabled: false,
    status: 'ПРОВЕРЕНО, ВЫКЛЮЧЕН: воркеру лента отвечает HTTP 403 — площадка отбивает запросы не из браузера.',
  },
  {
    id: 'tg_freelancce',
    kind: 'telegram',
    region: 'ru',
    url: 'https://t.me/s/freelancce',
    label: 'TG @freelancce',
    enabled: false,
    status: 'НЕ ПРОВЕРЕНО ПО СВЕЖЕСТИ: последние посты, которые мы видели, — 02.07.2026. Механика t.me/s/ рабочая, нужен живой профильный канал.',
  },
];

// Сколько символов описания тянуть в уведомление.
export const DESCRIPTION_LIMIT = 600;
