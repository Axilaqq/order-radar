// Ключевые слова, по которым бот решает, интересен ли заказ.
// w — вес. Итоговый балл заказа = сумма весов сработавших правил.
// tag — короткая метка, попадает в уведомление, чтобы было видно, почему заказ прошёл.
// id — нужен, чтобы конкретный источник мог выключить правило через ignoreRules
//      в config/sources.js. Например, на бирже по 1С правило «1С» не различает
//      заказы: оно срабатывает у всех и в одиночку пробивает порог.
export const KEYWORDS = [
  { id: '1c', re: /(^|[^a-zа-я])1с([^a-zа-я]|$)|1c[\s-]?предприят|унф|управление торговлей|бухгалтери/i, w: 5, tag: '1С' },
  { id: 'bitrix', re: /битрикс\s?24|bitrix\s?24/i, w: 4, tag: 'Битрикс24' },
  { id: 'tgbot', re: /телеграм[\s-]?бот|telegram[\s-]?bot|тг[\s-]?бот|бот для telegram|бота? в телеграм/i, w: 4, tag: 'TG-бот' },
  { id: 'parsing', re: /парсер|парсинг|scraping|scraper|краулер|crawler/i, w: 4, tag: 'парсинг' },
  { id: 'automation', re: /автоматизаци|automation|интеграци|integration|\bapi\b|вебхук|webhook|синхронизаци|обмен данными/i, w: 3, tag: 'автоматизация' },
  { id: 'ai', re: /\bai\b|\bgpt\b|\bllm\b|нейросет|искусственн\w+ интеллект|chatgpt|openai|claude|n8n|make\.com/i, w: 3, tag: 'AI' },
  { id: 'marketplace', re: /ozon|wildberries|вайлдберриз|озон|яндекс[\s-]?маркет|маркетплейс/i, w: 3, tag: 'маркетплейсы' },
  { id: 'transfer', re: /выгрузк|загрузк|перенос данных|обмен между|сверк/i, w: 2, tag: 'обмен данных' },
  { id: 'crm', re: /amocrm|амосрм|\bcrm\b|срм[\s-]?систем/i, w: 2, tag: 'CRM' },
  { id: 'sheets', re: /excel|xlsx|google\s?sheets|гугл[\s-]?таблиц|\bcsv\b|прайс[\s-]?лист/i, w: 2, tag: 'таблицы' },
  { id: 'stack', re: /supabase|postgres|cloudflare|vercel|serverless/i, w: 2, tag: 'наш стек' },
  { id: 'lang', re: /python|node\.?js|javascript|typescript/i, w: 1, tag: 'язык' },

  // Английские правила — для западных площадок (RemoteOK, Jobicy, WWR, Arbeitnow).
  // Русские правила там почти не срабатывают, а профиль тот же: автоматизация,
  // интеграции, обмен данными, боты.
  { id: 'en_automation', re: /\bautomation\b|\bautomate\b|\bworkflow\b|zapier|\bmake\.com\b|\bn8n\b|no[- ]?code|low[- ]?code|airtable/i, w: 4, tag: 'automation' },
  { id: 'en_integration', re: /\bintegration\b|\bintegrat(e|ing)\b|\bwebhook\b|\brest api\b|third[- ]party api/i, w: 3, tag: 'integration' },
  { id: 'en_data', re: /\betl\b|data pipeline|data migration|web scraping|\bscraper\b|\bcrawler\b/i, w: 4, tag: 'data' },
  { id: 'en_bot', re: /telegram bot|chatbot|\bslack bot\b|discord bot/i, w: 4, tag: 'bot' },
  { id: 'en_erp', re: /\berp\b|\bcrm\b|salesforce|hubspot|netsuite|odoo|sap\b/i, w: 2, tag: 'ERP/CRM' },
  { id: 'en_contract', re: /\bcontract\b|\bfreelance\b|\bpart[- ]time\b|project[- ]based/i, w: 2, tag: 'контракт' },
];

// Если сработало любое стоп-правило — заказ отбрасывается независимо от баллов.
export const STOP_WORDS = [
  /курсов(ая|ую|ой)|диплом(н|ную)|реферат|контрольн(ая|ую)|\bвкр\b/i,
  /казино|беттинг|ставки на спорт|1xbet|букмекер/i,
  /накрутк|подписчик(ов|и) за|лайк(ов|и) за|просмотр(ов|ы) за/i,
  /отзыв(ы|ов) за (деньги|отзыв)|написать отзыв на wildberries/i,
  /\bmlm\b|сетевой маркетинг|финансовая пирамида/i,
  /знакомств|эскорт|18\+/i,
];

// Отбрасывать объявления на украинском языке. Как это определяется — в src/language.js.
export const SKIP_UKRAINIAN = true;

// Минимальный балл по умолчанию. Источник может задать свой через minScore.
export const MIN_SCORE = 3;
