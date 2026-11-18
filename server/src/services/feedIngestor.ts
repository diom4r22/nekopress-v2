import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { FeedConfig, NewsItem, NewsSource } from '../types.js';
import { listNewsArticles, saveNewsArticles, getCachedTranslation, purgeInvalidNewsArticles } from '../db/database.js';
import { classifyNews } from './editorial.js';
import { geminiCurator } from './geminiCurator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SERVER_DIR = path.resolve(__dirname, '..', '..');

const UA = 'NekoPress-RSS-Ingestor/2.0 (+https://github.com/nekopress/nekopress-v2)';
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const ITEMS_PER_FEED = 50;
const JAPANESE_CHAR_REGEX = /[\u3040-\u30ff\u4e00-\u9faf]/;
const FRENCH_HINT_REGEX = /\b(avec|pour|dans|sur|les|des|une|est|sont|ajoute|abandonne|théorie|révèle|officiels|jusqu’à|jusqu'à|nouveau|nouvelle|saison|bande-annonce|bande|annonce|sortie|contre|après|avant)\b/gi;

function isLikelyFrench(text: string): boolean {
  const matches = text.match(FRENCH_HINT_REGEX);
  return Boolean(matches && matches.length >= 2);
}

const ENGLISH_HEADLINE_REGEX =
  /\b(streams|reveals|announces|joins|brings|exclusive|preview|episode\s+\d+|season\s+\d+|release\s+the\s+villains|watch\s+the|new\s+trailer|official\s+trailer)\b/i;

function isLikelyEnglishHeadline(text: string): boolean {
  return (
    ENGLISH_HEADLINE_REGEX.test(text) &&
    !/\b(el|la|los|las|del|una|un|estrena|revela|anuncia|temporada|episodio|para|con|por)\b/i.test(text)
  );
}

export const FEEDS: FeedConfig[] = [
  {
    id: 'aniplex-us-video', name: 'Aniplex of America', url: 'https://www.youtube.com/user/AniplexUS',
    feedUrl: 'https://www.youtube.com/feeds/videos.xml?user=AniplexUS', language: 'en', country: 'US',
  },
  {
    id: 'crunchyroll-es',
    name: 'Crunchyroll Noticias',
    url: 'https://www.crunchyroll.com/es/news',
    feedUrl: 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/es-419/rss',
    language: 'es',
    country: 'US',
  },
  {
    id: 'anmosugoi',
    name: 'Anmo Sugoi',
    url: 'https://www.anmosugoi.com',
    feedUrl: 'https://www.anmosugoi.com/feed/',
    language: 'es',
    country: 'LATAM',
  },
  {
    id: 'ramenparados',
    name: 'Ramen Para Dos',
    url: 'https://ramenparados.com',
    feedUrl: 'https://ramenparados.com/feed/',
    language: 'es',
    country: 'ES',
  },
  {
    id: 'animeanime-jp',
    name: 'Anime! Anime! Japón',
    url: 'https://animeanime.jp',
    feedUrl: 'https://animeanime.jp/rss/index.rdf',
    language: 'ja',
    country: 'JP',
  },
  {
    id: 'ann',
    name: 'Anime News Network',
    url: 'https://www.animenewsnetwork.com',
    feedUrl: 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w',
    language: 'en',
    country: 'US',
  },
  {
    id: 'animecorner',
    name: 'Anime Corner',
    url: 'https://animecorner.me',
    feedUrl: 'https://animecorner.me/feed/',
    language: 'en',
    country: 'US',
  },
  {
    id: 'otaku-usa',
    name: 'Otaku USA Magazine',
    url: 'https://otakuusamagazine.com',
    feedUrl: 'https://otakuusamagazine.com/feed/',
    language: 'en',
    country: 'US',
  },
  {
    id: 'crunchyroll-en',
    name: 'Crunchyroll News',
    url: 'https://www.crunchyroll.com/news',
    feedUrl: 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss',
    language: 'en',
    country: 'US',
  },
  {
    id: 'mal-news',
    name: 'MyAnimeList News',
    url: 'https://myanimelist.net/news',
    feedUrl: 'https://myanimelist.net/rss/news.xml',
    language: 'en',
    country: 'US',
  },
];

// HTML entity table including Spanish accents
const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
  ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü',
  iquest: '¿', iexcl: '¡', copy: '©', reg: '®', trade: '™',
};

function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function cleanText(html: string, max = 320): string {
  const text = decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trim() + '…';
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

interface StoreData {
  items: NewsItem[];
  imageCache: Record<string, string | null>;
  sourceStats: Record<string, { lastFetchedAt?: string; lastSuccessAt?: string; lastCount: number; error?: string }>;
}

export class FeedIngestor {
  private parser = new Parser({
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8' },
    timeout: 15000,
    customFields: {
      item: [
        ['media:thumbnail', 'mediaThumbnail'],
        ['media:content', 'mediaContent'],
        ['content:encoded', 'contentEncoded'],
      ],
    },
  });
  private store: StoreData = { items: [], imageCache: {}, sourceStats: {} };
  private storePath: string;
  private isSyncing = false;

  constructor(baseDir = DEFAULT_SERVER_DIR) {
    this.storePath = path.resolve(baseDir, 'data', 'news-store.json');
    this.loadStore();
  }

  private loadStore() {
    try {
      purgeInvalidNewsArticles();
    } catch (err) {
      console.warn('[FeedIngestor] Error limpiando SQLite:', (err as Error).message);
    }

    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf8');
        this.store = JSON.parse(raw);
        this.pruneOldItems();
      }
      // Populate SQLite with existing items or hydrate from SQLite if empty
      const dbArticles = listNewsArticles().filter((item) => !item.isRadarFlash && item.sourceType !== 'x_radar');
      if (this.store.items.length === 0 && dbArticles.length > 0) {
        this.store.items = dbArticles;
      }

      // Purgar Reddit, puzzles/crosswords e imágenes estáticas heredadas del catálogo
      this.store.items = this.store.items.filter((item) => {
        const isReddit = (item.sourceName || '').toLowerCase().includes('reddit');
        const isQuiz = /\bpuzzles?\b|\bcrosswords?\b/i.test(item.title || '');
        return !isReddit && !isQuiz;
      });

      for (const key of Object.keys(this.store.imageCache)) {
        const val = this.store.imageCache[key];
        if (!val || val.includes('s4.anilist.co') || val.includes('cdn.myanimelist.net/images/anime/')) {
          delete this.store.imageCache[key];
        }
      }

      // Aplicar traducciones en caché y eliminar cualquier imagen estática del catálogo
      for (const item of this.store.items) {
        const cached = getCachedTranslation(item.id);
        if (cached && !isLikelyEnglishHeadline(cached.title)) {
          item.title = cached.title;
          if (cached.summary) {
            item.summary = cached.summary;
            item.lead = cached.summary;
          }
          item.language = 'es';
        }
        if (
          item.imageUrl &&
          (item.imageUrl.includes('s4.anilist.co') ||
            item.imageUrl.includes('cdn.myanimelist.net/images/anime/') ||
            item.imageUrl.includes('953500.jpg'))
        ) {
          item.imageUrl = undefined;
        }
      }

      this.saveStore();
      if (this.store.items.length > 0) {
        saveNewsArticles(this.store.items);
      }
    } catch (err) {
      console.warn('[FeedIngestor] No se pudo leer news-store.json previo, iniciando limpio.');
    }
  }

  public async translatePendingItems(): Promise<void> {
    // Priorizar estrictamente las notas más recientes sin importar idioma origen (EN/JA/FR) para que la portada salga 100% en español
    const untranslated = this.store.items
      .filter((item) => {
        if (JAPANESE_CHAR_REGEX.test(item.title)) return true;
        if (isLikelyFrench(item.title)) return true;
        if (isLikelyEnglishHeadline(item.title)) return true;
        if (item.curatedByAi) return false;
        return item.language !== 'es' && item.language === 'en';
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 60);

    if (untranslated.length === 0) return;

    const updatedItems: NewsItem[] = [];
    for (let i = 0; i < untranslated.length; i += 10) {
      const chunk = untranslated.slice(i, i + 10);
      const translations = await geminiCurator.translateBatchToSpanish(
        chunk.map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.summary || item.lead || '',
        }))
      );

      for (const item of chunk) {
        const t = translations[item.id];
        if (t && t.title) {
          item.title = t.title;
          if (t.summary) {
            item.summary = t.summary;
            item.lead = t.summary;
          }
          item.language = 'es';
          item.curatedByAi = true;
          updatedItems.push(item);
        }
      }
    }

    if (updatedItems.length > 0) {
      this.saveStore();
      try {
        saveNewsArticles(updatedItems);
      } catch {}
      console.log(`[FeedIngestor] ✓ Traducidas al español ${updatedItems.length} notas.`);
    }
  }

  private saveStore() {
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
      const tempPath = this.storePath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.store, null, 2), 'utf8');
      fs.renameSync(tempPath, this.storePath);
    } catch (err) {
      console.error('[FeedIngestor] Error al guardar store:', err);
    }
  }

  private pruneOldItems() {
    const cutoff = Date.now() - MAX_AGE_MS;
    this.store.items = this.store.items.filter((item) => new Date(item.publishedAt).getTime() >= cutoff);
    const validUrls = new Set(this.store.items.map((i) => i.url));
    for (const u of Object.keys(this.store.imageCache)) {
      if (!validUrls.has(u)) delete this.store.imageCache[u];
    }
  }

  getItems(): NewsItem[] {
    // Ocultar temporalmente notas en japonés crudo mientras esperan su traducción al español
    return this.store.items.filter((item) => !JAPANESE_CHAR_REGEX.test(item.title));
  }

  getItemBySlug(slug: string): NewsItem | undefined {
    return this.store.items.find((item) => item.slug === slug);
  }

  getSources(): NewsSource[] {
    return FEEDS.map((f) => {
      const stats = this.store.sourceStats[f.id];
      const count = this.store.items.filter((i) => i.sourceName === f.name).length;
      return {
        id: f.id,
        name: f.name,
        url: f.url,
        feedUrl: f.feedUrl,
        language: f.language,
        country: f.country,
        lastFetchedAt: stats?.lastFetchedAt,
        lastSuccessAt: stats?.lastSuccessAt ?? (stats?.error ? undefined : stats?.lastFetchedAt),
        itemCount: count,
        status: stats?.error ? 'error' : 'active',
        lastError: stats?.error,
      };
    });
  }

  private async verifyImage(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Range: 'bytes=0-1024' },
        signal: AbortSignal.timeout(3500),
      });
      const ct = res.headers.get('content-type') || '';
      await res.body?.cancel().catch(() => {});
      return (res.status === 200 || res.status === 206) && ct.startsWith('image/');
    } catch {
      return false;
    }
  }

  private async resolveImage(articleUrl: string, feedCandidate?: string): Promise<string | undefined> {
    if (feedCandidate && feedCandidate.startsWith('http')) {
      this.store.imageCache[articleUrl] = feedCandidate;
      return feedCandidate;
    }

    if (this.store.imageCache[articleUrl]) {
      return this.store.imageCache[articleUrl] || undefined;
    }

    // Extracción de OpenGraph con cabeceras de navegador y timeout generoso
    try {
      const res = await fetch(articleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const html = (await res.text()).slice(0, 150_000);
        const match =
          html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
        if (match && match[1]) {
          const absoluteUrl = new URL(decodeEntities(match[1]), articleUrl).toString();
          if (absoluteUrl.startsWith('http')) {
            this.store.imageCache[articleUrl] = absoluteUrl;
            return absoluteUrl;
          }
        }
      }
    } catch {}

    this.store.imageCache[articleUrl] = null;
    return undefined;
  }

  async sync(): Promise<{ added: number; total: number }> {
    if (this.isSyncing) {
      return { added: 0, total: this.store.items.length };
    }

    this.isSyncing = true;
    const now = Date.now();
    const cutoff = now - MAX_AGE_MS;
    const existingUrls = new Set(this.store.items.map((i) => i.url));
    const newItems: NewsItem[] = [];
    const healedItems: NewsItem[] = [];

    console.log(`[FeedIngestor] Iniciando ciclo de sincronización de ${FEEDS.length} agencias en paralelo...`);

    await Promise.all(
      FEEDS.map(async (feed) => {
        try {
          const parsed = await this.parser.parseURL(feed.feedUrl);
          const candidates = (parsed.items || []).slice(0, ITEMS_PER_FEED);
          let feedAdded = 0;

          // Process candidates concurrently in small batches of 4
          const batchSize = 4;
          for (let i = 0; i < candidates.length; i += batchSize) {
            const batch = candidates.slice(i, i + batchSize);
            await Promise.all(
              batch.map(async (item) => {
                if (!item.title || !item.link) return;
                // El canal piloto aporta tráilers y anuncios con enlace al video original.
                const officialVideo = feed.id === 'aniplex-us-video';
                if (officialVideo && !/\b(?:trailers?|teasers?|announcements?|premieres?|pv)\b/i.test(item.title)) return;
                const video = officialVideo ? /^https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})$/.exec(item.link.trim()) : null;
                if (officialVideo && !video) return;
                if (/\bpuzzles?\b|\bcrosswords?\b/i.test(item.title)) return;
                const url = item.link.trim();
                if (existingUrls.has(url)) {
                  const existing = this.store.items.find((i) => i.url === url);
                  if (existing && !existing.imageUrl) {
                    let feedImgCandidate: string | undefined =
                      item.enclosure?.url ||
                      (item as any).mediaThumbnail?.['$']?.url ||
                      (item as any).mediaContent?.['$']?.url ||
                      (item as any)['media:thumbnail']?.['$']?.url ||
                      (item as any)['media:content']?.['$']?.url;

                    if (!feedImgCandidate) {
                      const htmlToScan = (item as any).contentEncoded || (item as any)['content:encoded'] || item.content || '';
                      const m = htmlToScan.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
                      if (m && m[1]) feedImgCandidate = m[1];
                    }

                    const resolvedImage = video ? `https://i.ytimg.com/vi/${video[1]}/hqdefault.jpg` : await this.resolveImage(url, feedImgCandidate);
                    if (resolvedImage) {
                      existing.imageUrl = resolvedImage;
                      healedItems.push(existing);
                    }
                  }
                  return;
                }

                const dateStr = item.isoDate || item.pubDate;
                const pubTime = dateStr ? new Date(dateStr).getTime() : now;
                if (isNaN(pubTime) || pubTime < cutoff) return;

                // Extract candidate image from feed tags with robust RSS Media extensions support
                let feedImgCandidate: string | undefined =
                  item.enclosure?.url ||
                  (item as any).mediaThumbnail?.['$']?.url ||
                  (item as any).mediaContent?.['$']?.url ||
                  (item as any)['media:thumbnail']?.['$']?.url ||
                  (item as any)['media:content']?.['$']?.url;

                if (!feedImgCandidate) {
                  const htmlToScan = (item as any).contentEncoded || (item as any)['content:encoded'] || item.content || '';
                  const m = htmlToScan.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
                  if (m && m[1]) feedImgCandidate = m[1];
                }

                const resolvedImage = video ? `https://i.ytimg.com/vi/${video[1]}/hqdefault.jpg` : await this.resolveImage(url, feedImgCandidate);
                const title = cleanText(item.title, 200);
                const summary = cleanText(item.contentSnippet || item.summary || item.content || '', 300);
                const rawFull = cleanText((item as any)['content:encoded'] || item.content || item.contentSnippet || '', 2000);
                const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 8);

                const lead = summary || title;
                const content = rawFull && rawFull.length > 200 ? rawFull : `${lead}\n\nDespacho verificado emitido por ${feed.name}. La cobertura completa y detalles adicionales de producción están disponibles directamente a través del enlace a la fuente oficial.`;

                const baseSlug = slugify(title) || feed.id;
                const newsItem: NewsItem = {
                  id: `${feed.id}-${hash}`,
                  title,
                  slug: `${baseSlug}-${hash}`,
                  lead,
                  content,
                  summary: summary === title ? '' : summary,
                  url,
                  sourceName: feed.name,
                  sourceUrl: feed.url,
                  author: item.creator || undefined,
                  publishedAt: new Date(pubTime).toISOString(),
                  imageUrl: resolvedImage,
                  category: classifyNews(title, summary),
                  tags: (item.categories || []).map((c) => cleanText(String(c), 30)).filter(Boolean).slice(0, 5),
                  language: feed.language,
                  isVerified: true,
                  sourceType: 'rss',
                  verificationBadge: 'verified_official',
                };

                newItems.push(newsItem);
                existingUrls.add(url);
                feedAdded++;
              })
            );
          }

          this.store.sourceStats[feed.id] = {
            lastFetchedAt: new Date().toISOString(),
            lastSuccessAt: new Date().toISOString(),
            lastCount: feedAdded,
          };
          console.log(`[FeedIngestor] ✓ ${feed.name}: +${feedAdded} notas.`);
        } catch (err) {
          console.warn(`[FeedIngestor] ⚠ Error en feed ${feed.name}:`, (err as Error).message);
          this.store.sourceStats[feed.id] = {
            lastFetchedAt: new Date().toISOString(),
            lastSuccessAt: this.store.sourceStats[feed.id]?.lastSuccessAt ?? (this.store.sourceStats[feed.id]?.error ? undefined : this.store.sourceStats[feed.id]?.lastFetchedAt),
            lastCount: 0,
            error: (err as Error).message,
          };
        }
      })
    );

    if (newItems.length > 0 || healedItems.length > 0) {
      if (newItems.length > 0) {
        // Merge, sort by publishedAt descending, and save to SQLite and JSON
        this.store.items = [...newItems, ...this.store.items].sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
      }
      try {
        if (newItems.length > 0) saveNewsArticles(newItems);
        if (healedItems.length > 0) saveNewsArticles(healedItems);
      } catch (err) {
        console.warn('[FeedIngestor] Error al persistir en SQLite:', (err as Error).message);
      }
    }

    this.saveStore();
    await this.translatePendingItems();

    this.isSyncing = false;
    console.log(`[FeedIngestor] Sincronización completada. Total notas en base: ${this.store.items.length}`);
    return { added: newItems.length, total: this.store.items.length };
  }
}
