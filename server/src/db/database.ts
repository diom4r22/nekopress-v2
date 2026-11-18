/**
 * Persistencia local de NekoPress v2.
 * news_articles acumula el histórico de RSS y primicias del Radar X.
 * user_bookmarks guarda notas y fichas de anime marcadas para leer más tarde.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { NewsItem } from '../types.js';

export type BookmarkKind = 'news' | 'anime';

export interface BookmarkRow {
  kind: BookmarkKind;
  itemId: string;
  savedAt: string;
  payload: unknown;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '..', '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'nekopress.db'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 3000');

db.exec(`
  CREATE TABLE IF NOT EXISTS news_articles (
    url_hash TEXT PRIMARY KEY,
    id TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    published_at TEXT NOT NULL,
    source_type TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_key TEXT NOT NULL DEFAULT 'local',
    kind TEXT NOT NULL CHECK (kind IN ('news', 'anime')),
    item_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (user_key, kind, item_id)
  );

  CREATE TABLE IF NOT EXISTS user_reading_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_key TEXT NOT NULL DEFAULT 'local',
    article_id TEXT NOT NULL,
    read_at TEXT NOT NULL,
    UNIQUE (user_key, article_id)
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_key TEXT NOT NULL,
    pref_key TEXT NOT NULL,
    pref_value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_key, pref_key)
  );

  CREATE TABLE IF NOT EXISTS user_tracked_anime (
    user_key TEXT NOT NULL,
    anime_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_key, anime_id)
  );

  CREATE TABLE IF NOT EXISTS editorial_ai_memory (
    topic_hash TEXT PRIMARY KEY,
    franchise TEXT NOT NULL,
    lead TEXT NOT NULL,
    full_content TEXT NOT NULL,
    sources_cited TEXT NOT NULL,
    last_updated TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS translation_cache (
    source_key TEXT PRIMARY KEY,
    title_es TEXT NOT NULL,
    summary_es TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles (published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON user_bookmarks (user_key, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_reading_user ON user_reading_history (user_key, read_at DESC);
`);

const upsertNews = db.prepare(`
  INSERT INTO news_articles (url_hash, id, url, payload, published_at, source_type, created_at)
  VALUES (@url_hash, @id, @url, @payload, @published_at, @source_type, @created_at)
  ON CONFLICT(url) DO UPDATE SET
    id = excluded.id,
    url_hash = excluded.url_hash,
    payload = excluded.payload,
    published_at = excluded.published_at,
    source_type = excluded.source_type
`);

const upsertBookmarkStmt = db.prepare(`
  INSERT INTO user_bookmarks (user_key, kind, item_id, payload, created_at)
  VALUES (@user_key, @kind, @item_id, @payload, @created_at)
  ON CONFLICT(user_key, kind, item_id) DO UPDATE SET
    payload = excluded.payload,
    created_at = excluded.created_at
`);

const deleteBookmarkStmt = db.prepare(`
  DELETE FROM user_bookmarks
  WHERE user_key = ? AND kind = ? AND item_id = ?
`);

function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(url.trim()).digest('hex');
}

export function saveNewsArticle(item: NewsItem): void {
  if (!item?.url) return;
  const url = item.url.trim();
  upsertNews.run({
    url_hash: hashUrl(url),
    id: item.id,
    url,
    payload: JSON.stringify(item),
    published_at: item.publishedAt || new Date().toISOString(),
    source_type: item.sourceType || (item.isRadarFlash ? 'x_radar' : 'rss'),
    created_at: new Date().toISOString(),
  });
}

const saveNewsBatch = db.transaction((items: NewsItem[]) => {
  for (const item of items) saveNewsArticle(item);
});

export function saveNewsArticles(items: NewsItem[]): void {
  if (items.length === 0) return;
  saveNewsBatch(items);
}

export function listNewsArticles(): NewsItem[] {
  const rows = db
    .prepare(`SELECT payload FROM news_articles ORDER BY published_at DESC`)
    .all() as Array<{ payload: string }>;

  const items: NewsItem[] = [];
  for (const row of rows) {
    try {
      items.push(JSON.parse(row.payload) as NewsItem);
    } catch {
      // Fila corrupta: se omite para no tumbar el wire.
    }
  }
  return items;
}

export function countNewsArticles(): number {
  const row = db.prepare(`SELECT COUNT(*) AS total FROM news_articles`).get() as { total: number };
  return row.total;
}

const INVALID_RADAR_OR_QUIZ_REGEX =
  /\[review\]|\breview:|\bcolumn:|\bpixelatl\b|\bi['’]m at\b|\bwhen the lights go down\b|\bsame as it ever was\b|\bpuzzles?\b|\bcrosswords?\b/i;

export function purgeInvalidNewsArticles(): number {
  const rows = db
    .prepare(`SELECT url_hash, payload FROM news_articles`)
    .all() as Array<{ url_hash: string; payload: string }>;

  const delStmt = db.prepare(`DELETE FROM news_articles WHERE url_hash = ?`);
  const updStmt = db.prepare(`UPDATE news_articles SET payload = ? WHERE url_hash = ?`);

  let affected = 0;
  const runCleanup = db.transaction(() => {
    for (const row of rows) {
      let item: NewsItem;
      try {
        item = JSON.parse(row.payload) as NewsItem;
      } catch {
        delStmt.run(row.url_hash);
        affected++;
        continue;
      }

      const isReddit = (item.sourceName || '').toLowerCase().includes('reddit');
      const isInvalidRadarOrQuiz =
        (item.isRadarFlash && INVALID_RADAR_OR_QUIZ_REGEX.test(item.title || '')) ||
        /\bpuzzles?\b|\bcrosswords?\b/i.test(item.title || '');

      if (isReddit || isInvalidRadarOrQuiz) {
        delStmt.run(row.url_hash);
        affected++;
        continue;
      }

      if (
        item.imageUrl &&
        (item.imageUrl.includes('s4.anilist.co') || item.imageUrl.includes('cdn.myanimelist.net/images/anime/'))
      ) {
        item.imageUrl = undefined;
        updStmt.run(JSON.stringify(item), row.url_hash);
        affected++;
      }
    }
  });

  runCleanup();
  return affected;
}

export function sanitizeUserKey(raw?: string): string {
  const cleaned = (raw || 'local').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || 'local';
}

export function upsertBookmark(input: {
  userKey: string;
  kind: BookmarkKind;
  itemId: string;
  payload: unknown;
  savedAt?: string;
}): BookmarkRow {
  const savedAt = input.savedAt || new Date().toISOString();
  upsertBookmarkStmt.run({
    user_key: input.userKey,
    kind: input.kind,
    item_id: input.itemId,
    payload: JSON.stringify(input.payload),
    created_at: savedAt,
  });
  return {
    kind: input.kind,
    itemId: input.itemId,
    savedAt,
    payload: input.payload,
  };
}

export function deleteBookmark(userKey: string, kind: BookmarkKind, itemId: string): boolean {
  const result = deleteBookmarkStmt.run(userKey, kind, itemId);
  return result.changes > 0;
}

export function listBookmarks(userKey: string): BookmarkRow[] {
  const rows = db
    .prepare(
      `SELECT kind, item_id AS itemId, payload, created_at AS savedAt
       FROM user_bookmarks
       WHERE user_key = ?
       ORDER BY created_at DESC`
    )
    .all(userKey) as Array<{ kind: BookmarkKind; itemId: string; payload: string; savedAt: string }>;

  return rows.map((row) => {
    let payload: unknown = {};
    try {
      payload = JSON.parse(row.payload);
    } catch {
      payload = {};
    }
    return {
      kind: row.kind,
      itemId: row.itemId,
      savedAt: row.savedAt,
      payload,
    };
  });
}

export function countBookmarks(): number {
  const row = db.prepare(`SELECT COUNT(*) AS total FROM user_bookmarks`).get() as { total: number };
  return row.total;
}

// -------------------------------------------------------------
// MEMORIA DE USUARIO & LECTURA (PERSISTENCIA TOTAL)
// -------------------------------------------------------------

const markReadStmt = db.prepare(`
  INSERT INTO user_reading_history (user_key, article_id, read_at)
  VALUES (?, ?, ?)
  ON CONFLICT(user_key, article_id) DO UPDATE SET read_at = excluded.read_at
`);

export function markArticleAsRead(userKey: string, articleId: string): void {
  markReadStmt.run(userKey, articleId, new Date().toISOString());
}

export function listReadArticles(userKey: string): string[] {
  const rows = db
    .prepare(`SELECT article_id FROM user_reading_history WHERE user_key = ? ORDER BY read_at DESC LIMIT 500`)
    .all(userKey) as Array<{ article_id: string }>;
  return rows.map((r) => r.article_id);
}

const savePrefStmt = db.prepare(`
  INSERT INTO user_preferences (user_key, pref_key, pref_value, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(user_key, pref_key) DO UPDATE SET
    pref_value = excluded.pref_value,
    updated_at = excluded.updated_at
`);

export function saveUserPreference(userKey: string, key: string, value: unknown): void {
  savePrefStmt.run(userKey, key, JSON.stringify(value), new Date().toISOString());
}

export function getUserPreferences(userKey: string): Record<string, unknown> {
  const rows = db
    .prepare(`SELECT pref_key, pref_value FROM user_preferences WHERE user_key = ?`)
    .all(userKey) as Array<{ pref_key: string; pref_value: string }>;
  const result: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      result[r.pref_key] = JSON.parse(r.pref_value);
    } catch {
      result[r.pref_key] = r.pref_value;
    }
  }
  return result;
}

const trackAnimeStmt = db.prepare(`
  INSERT INTO user_tracked_anime (user_key, anime_id, created_at)
  VALUES (?, ?, ?)
  ON CONFLICT(user_key, anime_id) DO NOTHING
`);

const untrackAnimeStmt = db.prepare(`
  DELETE FROM user_tracked_anime WHERE user_key = ? AND anime_id = ?
`);

export function trackAnime(userKey: string, animeId: number): void {
  trackAnimeStmt.run(userKey, animeId, new Date().toISOString());
}

export function untrackAnime(userKey: string, animeId: number): void {
  untrackAnimeStmt.run(userKey, animeId);
}

export function listTrackedAnime(userKey: string): number[] {
  const rows = db
    .prepare(`SELECT anime_id FROM user_tracked_anime WHERE user_key = ? ORDER BY created_at DESC`)
    .all(userKey) as Array<{ anime_id: number }>;
  return rows.map((r) => r.anime_id);
}

const getTranslationStmt = db.prepare(`
  SELECT title_es, summary_es FROM translation_cache WHERE source_key = ?
`);

const saveTranslationStmt = db.prepare(`
  INSERT INTO translation_cache (source_key, title_es, summary_es, model, created_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(source_key) DO UPDATE SET
    title_es = excluded.title_es,
    summary_es = excluded.summary_es,
    model = excluded.model
`);

export function getCachedTranslation(sourceKey: string): { title: string; summary: string } | null {
  const row = getTranslationStmt.get(sourceKey) as { title_es: string; summary_es: string } | undefined;
  return row ? { title: row.title_es, summary: row.summary_es } : null;
}

export function saveCachedTranslation(sourceKey: string, titleEs: string, summaryEs: string, model: string): void {
  saveTranslationStmt.run(sourceKey, titleEs, summaryEs, model, new Date().toISOString());
}

db.exec(`CREATE TABLE IF NOT EXISTS editorial_overrides (
  article_id TEXT PRIMARY KEY,
  category TEXT,
  hidden INTEGER NOT NULL DEFAULT 0
)`);

export function editorialOverrides() {
  const rows = db.prepare('SELECT article_id, category, hidden FROM editorial_overrides').all() as Array<{
    article_id: string; category: NewsItem['category'] | null; hidden: number;
  }>;
  return new Map(rows.map(row => [row.article_id, row]));
}

export function saveEditorialOverride(id: string, category: NewsItem['category'] | null, hidden: boolean) {
  if (!category && !hidden) {
    db.prepare('DELETE FROM editorial_overrides WHERE article_id = ?').run(id);
    return;
  }
  db.prepare(`INSERT INTO editorial_overrides (article_id, category, hidden) VALUES (?, ?, ?)
    ON CONFLICT(article_id) DO UPDATE SET category = excluded.category, hidden = excluded.hidden`)
    .run(id, category, Number(hidden));
}
