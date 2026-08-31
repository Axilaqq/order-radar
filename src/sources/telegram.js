import { stripTags, toIso, truncate } from '../util.js';
import { DESCRIPTION_LIMIT } from '../../config/sources.js';

// Разбирает публичное превью Telegram-канала: https://t.me/s/<channel>
// Это обычный HTML, бот и userbot не нужны. Работает только для открытых каналов.
export function parseTelegram(html, source) {
  const blocks = html.split('data-post="').slice(1);

  return blocks.map((block) => {
    const postId = (block.match(/^([^"]+)"/) || [])[1];
    if (!postId) return null;

    const textMatch = block.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const text = stripTags(textMatch ? textMatch[1] : '');
    if (!text) return null;

    const dateMatch = block.match(/<time[^>]+datetime="([^"]+)"/);
    const firstLine = text.split('\n').find((l) => l.trim().length > 0) || text;

    return {
      source_id: source.id,
      external_id: postId,
      title: truncate(firstLine, 160),
      url: `https://t.me/${postId}`,
      description: truncate(text, DESCRIPTION_LIMIT),
      budget: null,
      published_at: toIso(dateMatch ? dateMatch[1] : null),
    };
  }).filter(Boolean);
}
