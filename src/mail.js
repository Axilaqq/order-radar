// Уведомления с фриланс-площадок, пришедшие на почту.
//
// Площадки не дают доступа к личным сообщениям по API: переписка видна только
// внутри сайта под логином. Но почти каждая присылает письмо, когда заказчик
// написал или откликнулся. Это письмо и есть сигнал — его мы и ловим.
//
// Схема: Gmail → скрипт-сборщик (scripts/gmail-watcher.gs) → POST /inbox
// на воркере → Telegram. Пароли от площадок нигде не хранятся и не нужны.
//
// ВАЖНО ПРО БЕЗОПАСНОСТЬ. Письма с кодами подтверждения, ссылками на сброс
// пароля и уведомлениями о входе НИКОГДА не пересылаются в Telegram. Разовый
// код в чате — это готовый ключ от аккаунта для любого, кто получит доступ
// к переписке. Такие письма отсеиваются первыми, до всех прочих правил.

// Площадка определяется по домену отправителя.
const PLATFORMS = [
  { id: 'kwork', re: /kwork\.ru/i, label: 'Kwork' },
  { id: 'fl_ru', re: /(^|[@.])(fl|free-lance)\.ru/i, label: 'FL.ru' },
  { id: 'weblancer', re: /weblancer\.net/i, label: 'Weblancer' },
  { id: 'workspace', re: /workspace\.ru/i, label: 'Workspace' },
  { id: 'infostart', re: /infostart\.ru/i, label: 'Инфостарт' },
  { id: 'habr_career', re: /career\.habr\.com/i, label: 'Хабр Карьера' },
  { id: 'freelance_ru', re: /freelance\.ru/i, label: 'freelance.ru' },
  { id: 'upwork', re: /upwork\.com/i, label: 'Upwork' },
  { id: 'freelancer', re: /freelancer\.com/i, label: 'Freelancer.com' },
];

export function detectPlatform(from = '') {
  const hit = PLATFORMS.find((p) => p.re.test(String(from)));
  return hit ? { id: hit.id, label: hit.label } : { id: 'other', label: String(from).split('@').pop() || 'почта' };
}

// Разбор идёт ПО ТЕМЕ письма, а не по всему тексту. Тема — единственная
// строка, которую площадка пишет осмысленно; в подвале письма слово
// «сообщение» встречается и у рекламной рассылки, и тогда дайджест поехал бы
// в Telegram как личное сообщение.
//
// В регулярках ниже нет \w: в JavaScript \w — это только латиница,
// цифры и подчёркивание, кириллицу он не ловит. Поэтому окончания русских
// слов пишутся явным классом [а-яё], иначе «Новое сообщение» не совпадёт
// с «нов\w+ сообщени» и письмо молча уедет в «прочее».
const RULES = [
  // 1. Секреты. Проверяются первыми и всегда приводят к отказу.
  { kind: 'security', notify: false, re: /проверочн[а-яё]* код|код подтвержд|подтвержд[а-яё]* (электронн[а-яё]* )?почт|вход в аккаунт|нов[а-яё]* устройств|привязан номер|сброс[а-яё]* парол|восстановлен[а-яё]* доступ|активаци[а-яё]* аккаунт|активируйте|verification code|confirm your email|new sign-?in|reset your password|two-?factor/i },

  // 2. Рассылки и дайджесты. Заказы у нас и так собираются напрямую
  //    с площадок, второй раз через почту они не нужны.
  //    Формы «заказы дня» и «might interest you» добавлены после живого
  //    прогона 12.09.2026: письмо FL.ru «Ваши заказы дня» до этого
  //    проходило как движение по заказу и уезжало в Telegram.
  { kind: 'digest', notify: false, re: /нов[а-яё]* проект[а-яё]* на бирже|подходящ[а-яё]* проект|дайджест|подборк|рассылк|новост[а-яё]*|вакансии дня|заказы дня|заказ[а-яё]* для вас|как сделать так|рассказываем о|коротко о главном|newsletter|digest|weekly|might interest you|matching your skills|new activity in|posted in/i },

  // 3. Личное сообщение — то, ради чего всё это и делается.
  //    «Re:» в теме — ответ в переписке; площадки так дайджесты не подписывают.
  { kind: 'message', notify: true, re: /^\s*re:|нов[а-яё]* сообщени|получено сообщени|вам написал|ответил[а-яё]* вам|сообщени[а-яё]* от|переписк|new message|replied to you/i },

  // 4. Движение по заказу: отклик, приглашение, выбор исполнителя, оплата.
  { kind: 'order', notify: true, re: /отклик|ваш[а-яё]* заказ|нов[а-яё]* заказ|заказ №|предложени[а-яё]* по|приглашени|вас пригласили|выбрал[а-яё]* исполнител|исполнитель выбран|оплачен|заявк[а-яё]* на|принял[а-яё]* заказ|new (bid|proposal|offer|invitation)|you (were|have been) (invited|hired)/i },
];

// Отдаёт {kind, notify}. notify — единственное, что решает, поедет ли письмо
// в Telegram. Всё, что не опознано, молчит: лучше пропустить письмо, чем
// приучить себя не читать уведомления.
const MESSAGE_SENDER = /^(messages?|inbox|chat|dialog)@/i;

export function classifyMail({ subject = '', from = '' } = {}) {
  const s = `${subject}`;
  const platform = detectPlatform(from);
  for (const rule of RULES) {
    if (rule.re.test(s)) return { kind: rule.kind, notify: rule.notify, platform };
  }
  // Тема ничего не сказала — смотрим на адрес отправителя. Freelancer.com
  // шлёт личные сообщения с messages@notifications.freelancer.com, а в теме
  // у него только «Re: Имя». Секреты и дайджесты сюда уже не доходят:
  // они отсеяны правилами выше.
  const address = String(from).match(/<([^>]+)>/)?.[1] || String(from);
  if (MESSAGE_SENDER.test(address.trim())) return { kind: 'message', notify: true, platform };
  return { kind: 'other', notify: false, platform };
}

// Ссылки, по которым в письме нечего смотреть.
const JUNK_LINK = /unsubscribe|utm_content=logo|apps\.apple\.com|play\.google\.com|\.(png|jpg|gif|svg)(\?|$)/i;
// Ссылки, которые ведут прямо в переписку или в заказ.
const GOOD_LINK = /\/(inbox|messages?|dialog|chat|orders?|projects?|tasks?|bids?|proposals?)\b/i;

export function extractLink(body = '') {
  const urls = String(body).match(/https?:\/\/[^\s)\]"'<>]+/g) || [];
  const clean = urls.filter((u) => !JUNK_LINK.test(u));
  return clean.find((u) => GOOD_LINK.test(u)) || clean[0] || null;
}

// Кто написал. Площадки пишут это отдельной строкой: «от службы поддержки».
export function extractAuthor(body = '') {
  const m = String(body).match(/^\s*от\s+(.{2,80}?)\s*$/m);
  return m ? m[1].trim() : null;
}

// Текст самого сообщения. В письме Kwork он выделен звёздочками (курсив
// в исходном HTML). Если разметки нет — берём первый содержательный абзац.
export function extractText(body = '') {
  const s = String(body);
  const italic = s.match(/^\*([\s\S]{10,}?)\*\s*$/m);
  if (italic) return collapse(italic[1]);

  const paragraphs = s.split('\n')
    .map((l) => collapse(l))
    .filter((l) => l.length > 30 && !l.startsWith('|') && !/^https?:/.test(l) && !JUNK_LINK.test(l));
  return paragraphs[0] || null;
}

function collapse(s = '') {
  return String(s)
    // Пустые markdown-ссылки вида «текст[](адрес)» письма оставляют пачками.
    .replace(/\[\]\([^)]*\)/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Превращает письмо в событие для Telegram. Возвращает null, если письмо
// пересылать не нужно, — решение принимает classifyMail.
export function mailToEvent(mail = {}) {
  const verdict = classifyMail(mail);
  if (!verdict.notify) return { ...verdict, event: null };

  return {
    ...verdict,
    event: {
      id: mail.id || null,
      platform: verdict.platform.label,
      kind: verdict.kind,
      subject: collapse(mail.subject || ''),
      author: extractAuthor(mail.body || ''),
      text: extractText(mail.body || ''),
      url: extractLink(mail.body || ''),
      date: mail.date || null,
    },
  };
}
