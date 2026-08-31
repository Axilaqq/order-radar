// Тонкая обёртка над PostgREST API Supabase. Внешних библиотек намеренно нет:
// в Cloudflare Workers это уменьшает размер бандла и число мест, где что-то может сломаться.
export function db(env) {
  const base = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
  const headers = {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  async function call(path, init = {}) {
    const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${res.status} ${path}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }

  return {
    // Вставляет заказы и ВОЗВРАЩАЕТ ТОЛЬКО ТЕ, КОТОРЫХ ЕЩЁ НЕ БЫЛО.
    // Дубликаты отсекает уникальный индекс (source_id, external_id) — это и есть дедупликация.
    async insertNew(rows) {
      if (!rows.length) return [];
      return await call('/orders?on_conflict=source_id,external_id&select=*', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(rows),
      }) || [];
    },

    async markSent(ids) {
      if (!ids.length) return;
      await call(`/orders?id=in.(${ids.join(',')})`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }),
      });
    },

    async recent(limit = 10) {
      return await call(`/orders?select=id,title,url,budget,score,tags,source_id,found_at&order=found_at.desc&limit=${limit}`);
    },

    async statsLast24h() {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const all = await call(`/orders?select=source_id,status&found_at=gte.${since}`);
      const bySource = {};
      for (const row of all) {
        bySource[row.source_id] = bySource[row.source_id] || { total: 0, sent: 0 };
        bySource[row.source_id].total += 1;
        if (row.status === 'sent') bySource[row.source_id].sent += 1;
      }
      return { total: all.length, bySource };
    },

    async getSetting(key, fallback = null) {
      const rows = await call(`/settings?select=value&key=eq.${encodeURIComponent(key)}`);
      return rows && rows.length ? rows[0].value : fallback;
    },

    async setSetting(key, value) {
      await call('/settings?on_conflict=key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key, value }),
      });
    },

    async logRun(row) {
      await call('/runs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
    },
  };
}
