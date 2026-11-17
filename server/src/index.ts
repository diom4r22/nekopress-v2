import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FeedIngestor } from './services/feedIngestor.js';
import { animeLiveService } from './services/animeLiveService.js';
import { xRadarIngestor } from './services/xRadarIngestor.js';
import { geminiCurator } from './services/geminiCurator.js';
import { handleImageProxy, unwrapImageUrl } from './services/imageProxy.js';
import { NewsItem } from './types.js';
import {
  listBookmarks,
  upsertBookmark,
  deleteBookmark,
  sanitizeUserKey,
  countBookmarks,
  BookmarkKind,
  markArticleAsRead,
  listReadArticles,
  saveUserPreference,
  getUserPreferences,
  trackAnime,
  untrackAnime,
  listTrackedAnime,
} from './db/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const ingestor = new FeedIngestor();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Proxy local de imágenes para evitar fallos de CORS y hotlink
app.get('/api/image-proxy', handleImageProxy);

export function toProxiedImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const unwrapped = unwrapImageUrl(url);
  if (unwrapped.startsWith('http://') || unwrapped.startsWith('https://')) {
    return `/api/image-proxy?url=${encodeURIComponent(unwrapped)}`;
  }
  return unwrapped;
}

// Stop words para normalización y deduplicación de titulares
const DEDUP_STOP_WORDS = new Set([
  'season', 'episode', 'temporada', 'capitulo', 'episodio',
  'anime', 'manga', 'reveals', 'revela', 'announces', 'anuncia',
  'trailer', 'visual', 'video', 'stream', 'emision',
  'news', 'noticias', 'official', 'oficial', 'premiere', 'premieres',
  'estreno', 'estrenara', 'release', 'part', 'parte', 'review',
  'staff', 'cast', 'opening', 'ending', 'theme', 'song'
]);

const BILINGUAL_WORD_MAP: Record<string, string> = {
  anniversary: 'aniversario',
  animated: 'animado',
  animation: 'animacion',
  short: 'corto',
  movie: 'pelicula',
  film: 'pelicula',
  streams: 'estrena',
  streaming: 'estrena',
  game: 'juego',
  games: 'juegos',
  character: 'personaje',
  characters: 'personajes',
  celebrates: 'celebra',
  celebrating: 'celebra',
  story: 'historia',
  first: 'primer',
  collab: 'colaboracion',
  collaboration: 'colaboracion',
  special: 'especial',
  global: 'mundial',
  worldwide: 'mundial',
  series: 'serie',
  sequel: 'secuela',
  adaptation: 'adaptacion',
  debuts: 'debuta',
  opens: 'estrena',
  release: 'lanzamiento',
  releases: 'lanza',
  videojuego: 'juego',
  videojuegos: 'juegos',
};

function getTitleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .map((w) => BILINGUAL_WORD_MAP[w] || w)
      .filter((w) => w.length >= 4 && !DEDUP_STOP_WORDS.has(w))
  );
}

function areDuplicateNews(a: NewsItem, b: NewsItem): boolean {
  if (a.url === b.url || a.id === b.id) return true;

  const wordsA = getTitleWords(a.title);
  const wordsB = getTitleWords(b.title);
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  const similarity = intersection / union;
  const overlapRatio = intersection / Math.min(wordsA.size, wordsB.size);

  const timeDiff = Math.abs(new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  const within4Days = timeDiff < 4 * 24 * 60 * 60 * 1000;

  return (
    within4Days &&
    (similarity >= 0.45 ||
      (intersection >= 3 && similarity >= 0.35) ||
      (intersection >= 2 && overlapRatio >= 0.4))
  );
}

// Combine RSS agency news and X Radar instant flash scoops con deduplicación inteligente
function getAllNews(): NewsItem[] {
  const rssItems = ingestor.getItems();
  const radarItems = xRadarIngestor.getRadarItems();
  const rawList = [...radarItems, ...rssItems].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const deduped: NewsItem[] = [];

  for (const item of rawList) {
    const proxied = item.imageUrl ? { ...item, imageUrl: toProxiedImageUrl(item.imageUrl) } : item;
    const existing = deduped.find((d) => areDuplicateNews(d, proxied));
    if (existing) {
      // Si una de las dos versiones duplicadas tiene imagen y la otra no, heredarla
      if (!existing.imageUrl && proxied.imageUrl) {
        existing.imageUrl = proxied.imageUrl;
      }
      if (!proxied.imageUrl && existing.imageUrl) {
        proxied.imageUrl = existing.imageUrl;
      }
      // Priorizar la versión en español sobre versiones en inglés
      const isItemEs = proxied.language === 'es' || proxied.sourceName.includes('Noticias') || proxied.sourceName.includes('Ramen') || proxied.sourceName.includes('Anmo');
      const isExistingEs = existing.language === 'es' || existing.sourceName.includes('Noticias') || existing.sourceName.includes('Ramen') || existing.sourceName.includes('Anmo');
      if (isItemEs && !isExistingEs) {
        const idx = deduped.indexOf(existing);
        deduped[idx] = proxied;
      }
    } else {
      deduped.push(proxied);
    }
  }

  return deduped;
}

// Log HTTP requests
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

/**
 * GET /api/health
 */
app.get('/api/health', (req: Request, res: Response) => {
  const all = getAllNews();
  res.json({
    status: 'ok',
    service: 'NekoPress v2 Intelligence API',
    uptime: Math.floor(process.uptime()),
    totalNews: all.length,
    radarNewsCount: xRadarIngestor.getRadarItems().length,
    geminiAiActive: geminiCurator.hasApiKey(),
    ai: geminiCurator.getAiStatus(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ai/status', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    data: geminiCurator.getAiStatus(),
  });
});

/**
 * GET /api/news
 * Supports: page, limit, category, source, search
 */
app.get('/api/news', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.max(1, Math.min(50, parseInt(String(req.query.limit || '18'), 10)));
  const category = req.query.category ? String(req.query.category).toLowerCase() : undefined;
  const source = req.query.source ? String(req.query.source).toLowerCase() : undefined;
  const search = req.query.search ? String(req.query.search).toLowerCase().trim() : undefined;

  let filtered = getAllNews();

  if (category && category !== 'all' && category !== 'todas') {
    filtered = filtered.filter((item) => item.category.toLowerCase() === category);
  }

  if (source && source !== 'all') {
    filtered = filtered.filter((item) => item.sourceName.toLowerCase().includes(source));
  }

  if (search) {
    filtered = filtered.filter((item) => {
      const inTitle = item.title.toLowerCase().includes(search);
      const inSummary = item.summary.toLowerCase().includes(search);
      const inSource = item.sourceName.toLowerCase().includes(search);
      const inTags = item.tags.some((t) => t.toLowerCase().includes(search));
      return inTitle || inSummary || inSource || inTags;
    });
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  res.json({
    data: paginated,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
});

/**
 * GET /api/news/:slug
 */
app.get('/api/news/:slug', (req: Request, res: Response) => {
  const slug = String(req.params.slug || '');
  const all = getAllNews();
  const item = all.find((n) => n.slug === slug);

  if (!item) {
    return res.status(404).json({ error: 'Noticia no encontrada en el radar.' });
  }

  // Related news based on same category or source (excluding current item)
  const related = all
    .filter((n) => n.id !== item.id && (n.category === item.category || n.sourceName === item.sourceName))
    .slice(0, 4);

  res.json({
    data: item,
    related,
  });
});

/**
 * GET /api/radar/status
 */
app.get('/api/radar/status', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    accounts: xRadarIngestor.getRadarAccounts(),
    flashCount: xRadarIngestor.getRadarItems().length,
    geminiEnabled: geminiCurator.hasApiKey(),
    pollingIntervalSeconds: 45,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/radar/ingest
 * Permite inyectar tweets en vivo desde webhooks o extensiones
 */
app.post('/api/radar/ingest', async (req: Request, res: Response) => {
  try {
    const candidate = req.body;
    if (!candidate || !candidate.text || !candidate.authorHandle) {
      return res.status(400).json({ error: 'Faltan campos requeridos (text, authorHandle).' });
    }

    const item = await xRadarIngestor.ingestCandidate({
      id: candidate.id || `ext-${Date.now()}`,
      authorHandle: candidate.authorHandle,
      authorName: candidate.authorName || candidate.authorHandle,
      text: candidate.text,
      createdAt: candidate.createdAt || new Date().toISOString(),
      mediaUrls: Array.isArray(candidate.mediaUrls) ? candidate.mediaUrls : [],
      tweetUrl: candidate.tweetUrl || `https://x.com/${candidate.authorHandle.replace('@', '')}`,
    });

    if (!item) {
      return res.json({
        published: false,
        message: 'Descartado por la política editorial de Gemini (meme, opinión o spam).',
      });
    }

    res.json({
      published: true,
      data: item,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/sources
 */
app.get('/api/sources', (req: Request, res: Response) => {
  res.json({
    data: ingestor.getSources(),
  });
});

/**
 * GET /api/anime
 */
app.get('/api/anime', (req: Request, res: Response) => {
  const format = req.query.format ? String(req.query.format) : 'all';
  const studio = req.query.studio ? String(req.query.studio) : 'all';
  const status = req.query.status ? String(req.query.status) : 'all';
  const search = req.query.search ? String(req.query.search) : '';
  const sort = req.query.sort ? String(req.query.sort) : 'score';

  const list = animeLiveService
    .getCatalog({ format, studio, status, search, sort })
    .map((item) => ({
      ...item,
      imageUrl: item.imageUrl ? toProxiedImageUrl(item.imageUrl) : '',
    }));
  res.json({
    data: list,
    total: list.length,
  });
});

/**
 * GET /api/anime/:id
 */
app.get('/api/anime/:id', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const anime = animeLiveService.getAnimeById(id);

  if (!anime) {
    return res.status(404).json({ error: 'Anime no encontrado en el catálogo.' });
  }

  // Find related news from live RSS feeds that mention this anime!
  const searchTerms = [anime.title, anime.titleEnglish, ...anime.studios]
    .filter(Boolean)
    .map((t) => t!.toLowerCase());

  const relatedNews = getAllNews()
    .filter((news) => {
      const text = `${news.title} ${news.summary} ${news.tags.join(' ')}`.toLowerCase();
      return searchTerms.some((term) => term.length > 3 && text.includes(term));
    })
    .slice(0, 5);

  res.json({
    data: {
      ...anime,
      imageUrl: anime.imageUrl ? toProxiedImageUrl(anime.imageUrl) : '',
    },
    relatedNews,
  });
});

/**
 * GET /api/studios
 * Devuelve el resumen canónico de los 10 estudios de animación mayores
 */
app.get('/api/studios', (req: Request, res: Response) => {
  const studios = animeLiveService.getStudios();
  res.json({
    data: studios,
    total: studios.length,
  });
});

/**
 * GET /api/studios/:name
 * Devuelve el expediente técnico completo del estudio con obras maestras y proyectos activos
 */
app.get('/api/studios/:name', (req: Request, res: Response) => {
  const studioName = String(req.params.name || '');
  const dossier = animeLiveService.getStudioDossier(studioName);

  if (!dossier) {
    return res.status(404).json({ error: `Expediente del estudio "${studioName}" no encontrado.` });
  }

  res.json({
    data: {
      ...dossier,
      masterpieces: dossier.masterpieces.map((m) => ({
        ...m,
        imageUrl: m.imageUrl ? toProxiedImageUrl(m.imageUrl) || '' : '',
      })),
      activeAndUpcoming: dossier.activeAndUpcoming.map((m) => ({
        ...m,
        imageUrl: m.imageUrl ? toProxiedImageUrl(m.imageUrl) || '' : '',
      })),
    },
  });
});

/**
 * GET /api/schedule
 */
app.get('/api/schedule', (req: Request, res: Response) => {
  const day = req.query.day ? String(req.query.day).toLowerCase() : 'all';
  const platform = req.query.platform ? String(req.query.platform) : 'all';

  const items = animeLiveService.getSchedule(day, platform).map((item) => ({
    ...item,
    imageUrl: item.imageUrl ? toProxiedImageUrl(item.imageUrl) : '',
  }));
  const summary = animeLiveService.getDaySummary();
  const today = animeLiveService.getTodayDayName('Asia/Tokyo');

  res.json({
    data: items,
    total: items.length,
    today,
    summary,
  });
});

/**
 * GET /api/ranking
 */
app.get('/api/ranking', (req: Request, res: Response) => {
  const category = req.query.category ? String(req.query.category).toLowerCase() : 'all';
  const result = animeLiveService.getRanking(category);
  res.json({
    ...result,
    data: result.data.map((item) => ({
      ...item,
      imageUrl: item.imageUrl ? toProxiedImageUrl(item.imageUrl) : '',
    })),
  });
});

/**
 * ==========================================
 * RUTAS DE PERSISTENCIA: USER BOOKMARKS
 * ==========================================
 */

/**
 * GET /api/bookmarks
 * Obtiene los elementos guardados por el usuario
 */
app.get('/api/bookmarks', (req: Request, res: Response) => {
  try {
    const rawUserKey = (req.headers['x-user-key'] as string) || (req.query.userKey as string) || 'local';
    const userKey = sanitizeUserKey(rawUserKey);
    const bookmarks = listBookmarks(userKey).map((b) => {
      if (b.payload && typeof b.payload === 'object' && 'imageUrl' in b.payload) {
        const p = b.payload as Record<string, unknown>;
        if (typeof p.imageUrl === 'string' && p.imageUrl) {
          return {
            ...b,
            payload: { ...p, imageUrl: toProxiedImageUrl(p.imageUrl) },
          };
        }
      }
      return b;
    });
    res.json({
      success: true,
      data: bookmarks,
      total: bookmarks.length,
      globalCount: countBookmarks(),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/bookmarks
 * Guarda o actualiza un marcador (noticia o anime)
 */
app.post('/api/bookmarks', (req: Request, res: Response) => {
  try {
    const rawUserKey = (req.headers['x-user-key'] as string) || (req.body?.userKey as string) || 'local';
    const userKey = sanitizeUserKey(rawUserKey);
    const { kind, itemId, payload, savedAt } = req.body || {};

    if (!kind || (kind !== 'news' && kind !== 'anime')) {
      return res.status(400).json({ error: 'El campo "kind" debe ser "news" o "anime".' });
    }
    if (!itemId) {
      return res.status(400).json({ error: 'El campo "itemId" es obligatorio.' });
    }

    const row = upsertBookmark({
      userKey,
      kind: kind as BookmarkKind,
      itemId: String(itemId),
      payload: payload || {},
      savedAt: savedAt ? String(savedAt) : undefined,
    });

    res.json({
      success: true,
      data: row,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * DELETE /api/bookmarks/:kind/:itemId
 * Elimina un marcador
 */
app.delete('/api/bookmarks/:kind/:itemId', (req: Request, res: Response) => {
  try {
    const rawUserKey = (req.headers['x-user-key'] as string) || (req.query.userKey as string) || 'local';
    const userKey = sanitizeUserKey(rawUserKey);
    const kind = req.params.kind as BookmarkKind;
    const itemId = String(req.params.itemId || '');

    if (kind !== 'news' && kind !== 'anime') {
      return res.status(400).json({ error: 'El tipo debe ser "news" o "anime".' });
    }

    const removed = deleteBookmark(userKey, kind, itemId);
    res.json({
      success: true,
      removed,
      itemId,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/user/history
 * Devuelve el historial de artículos leídos por el usuario
 */
app.get('/api/user/history', (req: Request, res: Response) => {
  try {
    const rawUserKey = (req.headers['x-user-key'] as string) || (req.query.userKey as string) || 'local';
    const userKey = sanitizeUserKey(rawUserKey);
    const readIds = listReadArticles(userKey);
    res.json({ success: true, data: readIds, total: readIds.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/user/history
 * Marca un artículo como leído en la base de datos persistente
 */
app.post('/api/user/history', (req: Request, res: Response) => {
  try {
    const rawUserKey = (req.headers['x-user-key'] as string) || (req.body?.userKey as string) || 'local';
    const userKey = sanitizeUserKey(rawUserKey);
    const articleId = String(req.body?.articleId || '').trim();
    if (!articleId) return res.status(400).json({ error: 'articleId es requerido.' });
    markArticleAsRead(userKey, articleId);
    res.json({ success: true, articleId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET & POST /api/user/preferences
 * Memoria persistente de temas, filtros y preferencias del usuario
 */
app.get('/api/user/preferences', (req: Request, res: Response) => {
  try {
    const rawUserKey = (req.headers['x-user-key'] as string) || (req.query.userKey as string) || 'local';
    const userKey = sanitizeUserKey(rawUserKey);
    const prefs = getUserPreferences(userKey);
    res.json({ success: true, data: prefs });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/user/preferences', (req: Request, res: Response) => {
  try {
    const rawUserKey = (req.headers['x-user-key'] as string) || (req.body?.userKey as string) || 'local';
    const userKey = sanitizeUserKey(rawUserKey);
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ error: 'key es requerido.' });
    saveUserPreference(userKey, String(key), value);
    res.json({ success: true, key, value });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET, POST, DELETE /api/user/tracked
 * Seguimiento persistente de animes favoritos para alertas de primicias
 */
app.get('/api/user/tracked', (req: Request, res: Response) => {
  try {
    const rawUserKey = (req.headers['x-user-key'] as string) || (req.query.userKey as string) || 'local';
    const userKey = sanitizeUserKey(rawUserKey);
    const tracked = listTrackedAnime(userKey);
    res.json({ success: true, data: tracked, total: tracked.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/user/tracked', (req: Request, res: Response) => {
  try {
    const rawUserKey = (req.headers['x-user-key'] as string) || (req.body?.userKey as string) || 'local';
    const userKey = sanitizeUserKey(rawUserKey);
    const animeId = parseInt(String(req.body?.animeId), 10);
    if (isNaN(animeId)) return res.status(400).json({ error: 'animeId numérico es requerido.' });
    trackAnime(userKey, animeId);
    res.json({ success: true, animeId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/user/tracked/:animeId', (req: Request, res: Response) => {
  try {
    const rawUserKey = (req.headers['x-user-key'] as string) || (req.query.userKey as string) || 'local';
    const userKey = sanitizeUserKey(rawUserKey);
    const animeId = parseInt(String(req.params.animeId), 10);
    if (isNaN(animeId)) return res.status(400).json({ error: 'animeId numérico es requerido.' });
    untrackAnime(userKey, animeId);
    res.json({ success: true, animeId, removed: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/news/sync
 */
app.post('/api/news/sync', async (req: Request, res: Response) => {
  try {
    const [newsResult, radarResult, animeResult] = await Promise.all([
      ingestor.sync(),
      xRadarIngestor.sync(),
      animeLiveService.sync().catch(() => ({ catalogCount: 0, scheduleCount: 0 })),
    ]);
    res.json({
      success: true,
      added: newsResult.added + radarResult.added,
      total: getAllNews().length,
      radarCount: radarResult.total,
      catalogCount: animeResult.catalogCount,
      scheduleCount: animeResult.scheduleCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Servir frontend compilado (client/dist) si existe para modo producción o acceso directo al puerto 3001
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.get('*', (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

// Auto-sync on startup
ingestor.sync().catch(console.error);
xRadarIngestor.sync().catch(console.error);

// Routine polling: 45s for aggressive Radar X scoops, 60s for traditional RSS
setInterval(() => {
  xRadarIngestor.sync().catch(console.error);
}, 45 * 1000);

setInterval(() => {
  ingestor.sync().catch(console.error);
}, 5 * 60 * 1000);

// Reintento ligero de traducción IA cada 3.5 minutos para destrabar notas cuando Gemini salga de 503
setInterval(() => {
  if (!geminiCurator.getAiStatus().inCooldown) {
    ingestor.translatePendingItems().catch(console.error);
  }
}, 210 * 1000);

app.listen(PORT, () => {
  console.log(`\n============================================================`);
  console.log(` 猫PRESS v2 [NekoPress Core] — Backend RSS & X Radar Server`);
  console.log(` ▸ URL:          http://localhost:${PORT}`);
  console.log(` ▸ Health:       http://localhost:${PORT}/api/health`);
  console.log(` ▸ News API:     http://localhost:${PORT}/api/news`);
  console.log(` ▸ Radar API:    http://localhost:${PORT}/api/radar/status`);
  console.log(` ▸ Gemini AI:    ${geminiCurator.hasApiKey() ? 'Activo (Neuronal)' : 'Modo Heurístico (Sin clave)'}`);
  console.log(`============================================================\n`);
});
