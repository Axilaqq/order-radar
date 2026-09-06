// Список площадок, которые опрашивает бот.
// kind — адаптер: 'workspace' | 'weblancer' | 'infostart' | 'remoteok' | 'jobicy' |
//        'arbeitnow' | 'freelancehunt' | 'rss' | 'telegram'.
// region — для кого площадка: 'ru' | 'west'. Влияет только на читаемость конфига.
// enabled — включён ли источник.
// ignoreRules — id правил из config/keywords.js, которые здесь ничего не различают.
// minScore — свой порог вместо общего MIN_SCORE.
// headers — дополнительные заголовки запроса.
// status — честная пометка: что проверено, когда и с каким результатом.
export const SOURCES = [
  // ────────────────────────────── Россия ──────────────────────────────
  {
    id: 'workspace',
    kind: 'workspace',
    region: 'ru',
    // Общая страница списка, а НЕ категория /tenders/crm/.
    // Проверено 06.09.2026: в категории CRM самый свежий тендер от 18 августа,
    // и у всех приём заявок уже закрыт. На общей странице — 04, 03, 02 и
    // 01 сентября с открытыми сроками. Категория копит архив, поток идёт сюда;
    // профиль отбирает наш фильтр, а не рубрика площадки.
    //
    // robots.txt запрещает /tenders/? и /tenders/*/? — любые параметры запроса.
    // Сама /tenders/ без параметров не запрещена. Query-строку не подставляем.
    url: 'https://workspace.ru/tenders/',
    label: 'Workspace, тендеры',
    enabled: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept-Language': 'ru-RU,ru;q=0.9',
    },
    status: 'ПРОВЕРЕНО 06.09.2026: машинного доступа нет (RSS 404/403, sitemap без lastmod), поэтому разбираем HTML списка. На /tenders/ 10 свежих тендеров, бюджеты до 100 000 – от 1 200 000 ₽, поток ~2–3 в сутки по всем направлениям. Адаптер проверен на реальной сохранённой странице этого же адреса: 10 карточек из 10, бюджеты и даты верные. НЕ ПРОВЕРЕНО: пользовательское соглашение площадки насчёт автоматического сбора.',
  },
  {
    id: 'weblancer',
    kind: 'weblancer',
    region: 'ru',
    // Адрес /jobs/ перенаправляет сюда же. robots.txt закрывает /api/,
    // /account/, /ajax/, /socket* и любые адреса с параметрами (*page=,
    // *filter=, *action= и прочие). Чистая /freelance/ не запрещена —
    // ходим только на неё, query-строку не подставляем.
    url: 'https://www.weblancer.net/freelance/',
    label: 'Weblancer, заказы',
    enabled: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept-Language': 'ru-RU,ru;q=0.9',
    },
    status: 'ПРОВЕРЕНО 06.09.2026 в браузере: 20 карточек на странице, адаптер разобрал 20 из 20 — у всех дата, описание и число заявок, у 7 из 20 бюджет. Поток 20 заказов за двое суток, профильных 4 (Телеграм-боты, парсинг, локальные LLM), заявок на заказ 1–7. Бюджеты в долларах. Машинного доступа нет: /rss/projects/ отдаёт 404, фида в robots.txt нет. НЕ ПРОВЕРЕНО: ответит ли площадка воркеру — при заходе из браузера отдаётся проверка Cloudflare, она может отбить запрос не из браузера, как это делает FL.ru.',
  },
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
    status: 'ПРОВЕРЕНО: REST без токена, работает несколько суток подряд. ~1 заказ/сутки, медиана 10 000 ₽, откликов 6, комиссии нет, расчёты напрямую. Профильность 62%.',
  },

  // ───────────── Выключено: это ВАКАНСИИ, а не разовые заказы ─────────────
  // Решение владельца 06.09.2026: полноценная работа не нужна, нужны заказы,
  // которые закрывают подписки. Все четыре доски отдают найм в штат — другой
  // цикл, другой разговор, плюс нерешённый вопрос оплаты из РФ.
  // Адаптеры рабочие: если понадобится, включается одной строкой enabled: true.
  // Механизм перевода на русский (src/translate.js) остаётся — он пригодится
  // любому иностранному источнику, а не только этим.
  {
    id: 'remoteok',
    kind: 'remoteok',
    region: 'west',
    url: 'https://remoteok.com/api',
    label: 'RemoteOK',
    enabled: false,
    minScore: 5,
    status: 'ПРОВЕРЕНО: JSON без авторизации, ~25 свежих вакансий, есть salary_min/max в USD. Нулевой элемент массива — юридическая заметка, адаптер её пропускает. Замер 06.09.2026: профильных в выдаче ноль, поток нестабильный.',
  },
  {
    id: 'jobicy',
    kind: 'jobicy',
    region: 'west',
    url: 'https://jobicy.com/api/v2/remote-jobs?count=50&tag=developer',
    label: 'Jobicy',
    enabled: false,
    minScore: 5,
    status: 'ПРОВЕРЕНО: JSON без авторизации, есть annualSalaryMin/Max и jobGeo (US/EU). Площадка просит вести ссылку на оригинал вакансии — адаптер так и делает. Замер 06.09.2026: профильное — в основном Salesforce-разработка, 102 500 – 164 100 USD/год, но это найм в штат.',
  },
  {
    id: 'wwr',
    kind: 'rss',
    region: 'west',
    url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss',
    label: 'We Work Remotely',
    enabled: false,
    minScore: 5,
    status: 'ПРОВЕРЕНО: валидный RSS, 15 последних вакансий по программированию. Зарплата в ленте не приходит.',
  },
  {
    id: 'arbeitnow',
    kind: 'arbeitnow',
    region: 'west',
    url: 'https://www.arbeitnow.com/api/job-board-api',
    label: 'Arbeitnow (Европа)',
    enabled: false,
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
