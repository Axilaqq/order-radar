export function stripTags(html = '') {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function unwrapCdata(s = '') {
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : s;
}

export function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? unwrapCdata(m[1]).trim() : '';
}

export function truncate(s = '', n = 600) {
  const t = s.trim();
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…';
}

export function toIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Ответ площадки может прийти не в UTF-8: 1Clancer отдаёт RSS
// как windows-1251. res.text() в Node и в Workers декодирует как UTF-8
// и вместо «Задания» получается кракозябра. Поэтому charset берём
// из Content-Type и декодируем явно.
export function decodeBody(buffer, contentType = '') {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const m = String(contentType).match(/charset=([^\s;]+)/i);
  const charset = (m ? m[1] : 'utf-8').replace(/['"]/g, '').trim().toLowerCase();
  const label = charset === 'utf8' || charset === 'us-ascii' ? 'utf-8' : charset;
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
