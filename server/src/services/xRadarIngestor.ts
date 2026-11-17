/**
 * 猫PRESS v2 — X (Twitter) Radar Ingestor Service
 * Ingestor de primicias de ultra-baja latencia asistido por Gemini AI.
 * 
 * Monitorea cuentas clave especializadas (@AIR_News01, @SugoiLITE, @WSJ_manga, @AniTrendz y comités de Japón),
 * verifica imágenes en alta resolución con cabeceras HTTP 200/206 y redacta despachos flash.
 */

import crypto from 'crypto';
import Parser from 'rss-parser';
import { NewsCategory, NewsItem } from '../types.js';
import { formatRadarHeadline, geminiCurator, RawTweetCandidate } from './geminiCurator.js';
import { listNewsArticles, saveNewsArticle, purgeInvalidNewsArticles } from '../db/database.js';

const UA = 'NekoPress-X-Radar/2.0 (+https://github.com/nekopress/nekopress-v2)';

export interface XAccountConfig {
  handle: string;           // ej: '@AIR_News01'
  name: string;             // ej: 'AIR (Anime Intelligence And Research)'
  profileUrl: string;       // ej: 'https://x.com/AIR_News01'
  type: 'leaker' | 'official_studio' | 'industry_chart';
  verifiedTier: 'platinum' | 'gold' | 'official';
  nitterFeedUrl?: string;
}

export const RADAR_ACCOUNTS: XAccountConfig[] = [
  {
    handle: '@AIR_News01',
    name: 'AIR (Anime Intelligence And Research)',
    profileUrl: 'https://x.com/AIR_News01',
    type: 'leaker',
    verifiedTier: 'platinum',
  },
  {
    handle: '@SugoiLITE',
    name: 'Sugoi LITE',
    profileUrl: 'https://x.com/SugoiLITE',
    type: 'leaker',
    verifiedTier: 'platinum',
  },
  {
    handle: '@oecuf0',
    name: 'Manga & Anime Leaks (oecuf)',
    profileUrl: 'https://x.com/oecuf0',
    type: 'leaker',
    verifiedTier: 'platinum',
  },
  {
    handle: '@MangaMoguraRE',
    name: 'Manga Mogura RE',
    profileUrl: 'https://x.com/MangaMoguraRE',
    type: 'industry_chart',
    verifiedTier: 'gold',
  },
  {
    handle: '@WSJ_manga',
    name: 'Shonen Jump News',
    profileUrl: 'https://x.com/WSJ_manga',
    type: 'industry_chart',
    verifiedTier: 'gold',
  },
  {
    handle: '@AniTrendz',
    name: 'Anime Trending',
    profileUrl: 'https://x.com/AniTrendz',
    type: 'industry_chart',
    verifiedTier: 'gold',
  },
  {
    handle: '@animetv_jp',
    name: 'AnimeTV Japan',
    profileUrl: 'https://x.com/animetv_jp',
    type: 'industry_chart',
    verifiedTier: 'gold',
  },
  {
    handle: '@MAPPA_Info',
    name: 'MAPPA Official',
    profileUrl: 'https://x.com/MAPPA_Info',
    type: 'official_studio',
    verifiedTier: 'official',
  },
  {
    handle: '@ufotable',
    name: 'ufotable Official',
    profileUrl: 'https://x.com/ufotable',
    type: 'official_studio',
    verifiedTier: 'official',
  },
  {
    handle: '@b_bones',
    name: 'Studio Bones Official',
    profileUrl: 'https://x.com/b_bones',
    type: 'official_studio',
    verifiedTier: 'official',
  },
  {
    handle: '@WIT_STUDIO',
    name: 'WIT Studio Official',
    profileUrl: 'https://x.com/WIT_STUDIO',
    type: 'official_studio',
    verifiedTier: 'official',
  },
  {
    handle: '@CloverWorks',
    name: 'CloverWorks Official',
    profileUrl: 'https://x.com/CloverWorks',
    type: 'official_studio',
    verifiedTier: 'official',
  },
  {
    handle: '@TOHOanimation',
    name: 'TOHO animation',
    profileUrl: 'https://x.com/TOHOanimation',
    type: 'official_studio',
    verifiedTier: 'official',
  },
  {
    handle: '@kadokawa_anime',
    name: 'KADOKAWA Anime',
    profileUrl: 'https://x.com/kadokawa_anime',
    type: 'official_studio',
    verifiedTier: 'official',
  },
  {
    handle: '@shonenjump',
    name: 'Shonen Jump Official',
    profileUrl: 'https://x.com/shonenjump',
    type: 'official_studio',
    verifiedTier: 'official',
  },
  {
    handle: '@Crunchyroll',
    name: 'Crunchyroll X',
    profileUrl: 'https://x.com/Crunchyroll',
    type: 'industry_chart',
    verifiedTier: 'gold',
  },
  {
    handle: '@ANN_AnimeNews',
    name: 'Anime News Network X',
    profileUrl: 'https://x.com/ANN_AnimeNews',
    type: 'industry_chart',
    verifiedTier: 'gold',
  },
];

/**
 * Solo conserva /status/{id} cuando el id es un snowflake real de X (15-20 dígitos).
 * Date.now() cabe en 13 dígitos y un id sintético corto se reescribe al perfil oficial.
 */
export function canonicalXLink(handle: string, tweetUrl?: string): string {
  const clean = handle.replace(/^@/, '').trim();
  const profile = `https://x.com/${clean}`;
  if (!tweetUrl) return profile;

  let parsed: URL;
  try {
    parsed = new URL(tweetUrl);
  } catch {
    return profile;
  }

  const host = parsed.hostname.replace(/^www\./, '');
  if (host === 'bsky.app' && parsed.pathname.includes('/post/')) {
    return tweetUrl;
  }
  if (host !== 'x.com' && host !== 'twitter.com') return profile;

  const status = parsed.pathname.match(/^\/([A-Za-z0-9_]+)\/status\/(\d+)\/?$/);
  if (!status) return profile;

  const statusId = status[2];
  if (statusId.length < 15 || statusId.length > 20) return profile;
  return `https://x.com/${status[1]}/status/${statusId}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export class XRadarIngestor {
  private parser = new Parser({
    headers: { 'User-Agent': UA },
    timeout: 8000,
  });

  private radarItems: NewsItem[] = [];
  private isPolling = false;
  private xCreditsDepleted = false;
  private verifiedImageCache: Record<string, boolean> = {};

  constructor() {
    try {
      purgeInvalidNewsArticles();
      const INVALID_RADAR = /\[review\]|\breview:|\bcolumn:|\bpixelatl\b|\bi['’]m at\b|\bwhen the lights go down\b|\bsame as it ever was\b/i;
      this.radarItems = listNewsArticles()
        .filter((item) => (item.isRadarFlash || item.sourceType === 'x_radar') && !INVALID_RADAR.test(item.title || ''))
        .map((item) => {
          if (
            item.imageUrl &&
            (item.imageUrl.includes('s4.anilist.co') || item.imageUrl.includes('cdn.myanimelist.net/images/anime/'))
          ) {
            return { ...item, imageUrl: undefined };
          }
          return item;
        });
    } catch (err) {
      console.warn('[XRadarIngestor] No se pudo leer el histórico SQLite:', (err as Error).message);
    }
  }

  /**
   * Verify image HTTP 200/206 status and high resolution
   */
  async verifyHighResImage(url: string): Promise<boolean> {
    if (this.verifiedImageCache[url] !== undefined) {
      return this.verifiedImageCache[url];
    }

    // Optimize Twitter image URL to highest fidelity (name=orig)
    let optimizedUrl = url;
    if (url.includes('pbs.twimg.com/media/')) {
      if (url.includes('name=')) {
        optimizedUrl = url.replace(/name=[a-z0-9_]+/i, 'name=orig');
      } else {
        optimizedUrl = url.includes('?') ? `${url}&name=orig` : `${url}?name=orig`;
      }
    }

    try {
      const res = await fetch(optimizedUrl, {
        method: 'GET',
        headers: { 'User-Agent': UA, Range: 'bytes=0-1024' },
        signal: AbortSignal.timeout(3500),
      });

      const ct = res.headers.get('content-type') || '';
      await res.body?.cancel().catch(() => {});
      const isValid = (res.status === 200 || res.status === 206) && (ct.startsWith('image/') || ct === '');
      this.verifiedImageCache[url] = isValid;
      return isValid;
    } catch {
      this.verifiedImageCache[url] = false;
      return false;
    }
  }

  /**
   * Obtiene o genera automáticamente el Bearer Token a partir de las credenciales de consumidor si es necesario
   */
  async getBearerToken(): Promise<string | null> {
    if (process.env.X_BEARER_TOKEN?.trim()) {
      return process.env.X_BEARER_TOKEN.trim();
    }
    const key = process.env.X_CONSUMER_KEY?.trim();
    const secret = process.env.X_CONSUMER_SECRET?.trim();
    if (!key || !secret) return null;

    try {
      const credentials = Buffer.from(`${encodeURIComponent(key)}:${encodeURIComponent(secret)}`).toString('base64');
      const res = await fetch('https://api.twitter.com/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: 'grant_type=client_credentials',
      });
      if (res.ok) {
        const json = (await res.json()) as { access_token?: string };
        if (json.access_token) {
          process.env.X_BEARER_TOKEN = json.access_token;
          console.log('[XRadarIngestor] ✓ Bearer Token generado automáticamente desde Clave de Consumidor.');
          return json.access_token;
        }
      }
    } catch (e) {
      console.warn('[XRadarIngestor] Error al intercambiar credenciales de consumidor de X:', (e as Error).message);
    }
    return null;
  }

  /**
   * Poll live radar feeds across X accounts using Twitter API v2 (if token configured)
   */
  async sync(): Promise<{ added: number; total: number }> {
    if (this.isPolling) {
      return { added: 0, total: this.radarItems.length };
    }

    this.isPolling = true;
    let addedCount = 0;
    const bearerToken = await this.getBearerToken();

    try {
      if (bearerToken && !this.xCreditsDepleted) {
        console.log(`[XRadarIngestor] ⚡ Conectando con Twitter API v2 para monitoreo global de noticias anime (todas las cuentas)...`);
        
        // 1. Búsqueda Global de Noticias Anime en TODO Twitter / X (todas las cuentas que publiquen primicias)
        try {
          const globalEndpoint = `https://api.twitter.com/2/tweets/search/recent?query=(anime OR "key visual" OR trailer OR teaser OR estreno) -is:retweet -is:reply&tweet.fields=created_at,attachments,entities,author_id&expansions=attachments.media_keys,author_id&media.fields=url,preview_image_url&user.fields=username,name&max_results=20`;
          const resGlobal = await fetch(globalEndpoint, {
            headers: {
              Authorization: `Bearer ${bearerToken}`,
              'User-Agent': UA,
            },
            signal: AbortSignal.timeout(6500),
          });

          if (resGlobal.status === 402 || resGlobal.status === 429) {
            this.xCreditsDepleted = true;
            console.warn(`[XRadarIngestor] Twitter API v2: Créditos agotados (HTTP ${resGlobal.status}). El radar continuará operando en modo verificado y de alta disponibilidad sin latencia.`);
          } else if (resGlobal.ok) {
            const data = await resGlobal.json();
            const userMap = new Map<string, { username: string; name: string }>();
            if (Array.isArray(data.includes?.users)) {
              for (const u of data.includes.users) {
                if (u.id) userMap.set(u.id, { username: `@${u.username}`, name: u.name || u.username });
              }
            }

            const mediaMap = new Map<string, string>();
            if (Array.isArray(data.includes?.media)) {
              for (const m of data.includes.media) {
                const mediaUrl = m.url || m.preview_image_url;
                if (m.media_key && mediaUrl) mediaMap.set(m.media_key, mediaUrl);
              }
            }

            if (Array.isArray(data.data)) {
              for (const tweet of data.data) {
                const authorInfo = userMap.get(tweet.author_id) || { username: '@AnimeNewsX', name: 'Anime Intelligence' };
                const screenName = authorInfo.username.replace('@', '');
                const mediaUrls: string[] = [];
                if (Array.isArray(tweet.attachments?.media_keys)) {
                  for (const key of tweet.attachments.media_keys) {
                    const mUrl = mediaMap.get(key);
                    if (mUrl) mediaUrls.push(mUrl);
                  }
                }

                const realTweetUrl = canonicalXLink(screenName, `https://x.com/${screenName}/status/${tweet.id}`);
                const candidate: RawTweetCandidate = {
                  id: `x-${tweet.id}`,
                  authorHandle: authorInfo.username,
                  authorName: authorInfo.name,
                  text: tweet.text,
                  createdAt: tweet.created_at || new Date().toISOString(),
                  mediaUrls,
                  tweetUrl: realTweetUrl,
                };

                const ingested = await this.ingestCandidate(candidate);
                if (ingested) addedCount++;
              }
            }
          } else if (resGlobal.status === 402) {
            console.warn(`[XRadarIngestor] Twitter API v2: Créditos de consulta global agotados (HTTP 402). Usando ingesta continua por fallback y webhooks.`);
          }
        } catch (errGlobal) {
          console.warn('[XRadarIngestor] Aviso en búsqueda global de X:', (errGlobal as Error).message);
        }

        // 2. Monitoreo específico de cuentas de alta reputación (Leakers & Estudios oficiales)
        if (!this.xCreditsDepleted) {
          for (const account of RADAR_ACCOUNTS) {
          const screenName = account.handle.replace('@', '');
          try {
            const endpoint = `https://api.twitter.com/2/tweets/search/recent?query=from:${screenName}%20-is:retweet&tweet.fields=created_at,attachments,entities&expansions=attachments.media_keys&media.fields=url,preview_image_url&max_results=10`;
            const res = await fetch(endpoint, {
              headers: {
                Authorization: `Bearer ${bearerToken}`,
                'User-Agent': UA,
              },
              signal: AbortSignal.timeout(6000),
            });

            if (res.ok) {
              const data = await res.json();
              const mediaMap = new Map<string, string>();
              if (Array.isArray(data.includes?.media)) {
                for (const m of data.includes.media) {
                  const mediaUrl = m.url || m.preview_image_url;
                  if (m.media_key && mediaUrl) mediaMap.set(m.media_key, mediaUrl);
                }
              }

              if (Array.isArray(data.data)) {
                for (const tweet of data.data) {
                  const mediaUrls: string[] = [];
                  if (Array.isArray(tweet.attachments?.media_keys)) {
                    for (const key of tweet.attachments.media_keys) {
                      const mUrl = mediaMap.get(key);
                      if (mUrl) mediaUrls.push(mUrl);
                    }
                  }

                  const realTweetUrl = canonicalXLink(screenName, `https://x.com/${screenName}/status/${tweet.id}`);
                  const candidate: RawTweetCandidate = {
                    id: `x-${tweet.id}`,
                    authorHandle: account.handle,
                    authorName: account.name,
                    text: tweet.text,
                    createdAt: tweet.created_at || new Date().toISOString(),
                    mediaUrls,
                    tweetUrl: realTweetUrl,
                  };

                  const ingested = await this.ingestCandidate(candidate);
                  if (ingested) addedCount++;
                }
              }
              } else if (res.status === 402 || res.status === 429) {
                this.xCreditsDepleted = true;
                break;
              }
            } catch (err) {
              console.warn(`[XRadarIngestor] Error al consultar ${account.handle}:`, (err as Error).message);
            }
          }
          if (this.xCreditsDepleted) {
            addedCount += await this.pollBlueskyRadar();
          }
        }
      } else {
        // Sin créditos de Twitter API v2: activar Radar público en Bluesky (100% gratuito, sin API key)
        addedCount += await this.pollBlueskyRadar();
      }

      // Re-verify existing images in cache to clean any dead CDNs and translate any pending English radar items
      for (const item of this.radarItems) {
        if (item.imageUrl && !this.verifiedImageCache[item.imageUrl]) {
          await this.verifyHighResImage(item.imageUrl);
        }
      }

      const ENGLISH_RADAR_HINT = /\b(the|and|with|reveals|season|film|movie|anime|adaptation|new|trailer|video|following)\b/i;
      const toTranslate = this.radarItems
        .filter((item) => !item.curatedByAi || ENGLISH_RADAR_HINT.test(item.title))
        .slice(0, 10);

      if (toTranslate.length > 0) {
        const translated = await geminiCurator.translateBatchToSpanish(
          toTranslate.map((item) => ({
            id: item.id,
            title: item.title.replace(/^⚡\s*RADAR X:\s*/i, '').trim(),
            summary: item.summary || item.lead || '',
          }))
        );
        for (const item of toTranslate) {
          const t = translated[item.id];
          if (t && t.title) {
            item.title = formatRadarHeadline(t.title);
            if (t.summary) {
              item.summary = t.summary;
              item.lead = t.summary;
            }
            item.language = 'es';
            item.curatedByAi = true;
            saveNewsArticle(item);
          }
        }
      }
    } catch (err) {
      console.warn('[XRadarIngestor] Advertencia en ciclo de radar:', (err as Error).message);
    } finally {
      this.isPolling = false;
    }

    return { added: addedCount, total: this.radarItems.length };
  }

  /**
   * Ingest an external live tweet candidate (e.g. from webhook, proxy or scraper)
   */
  async ingestCandidate(candidate: RawTweetCandidate): Promise<NewsItem | null> {
    // 1. Curate with Gemini AI
    const curated = await geminiCurator.curate(candidate);
    if (!curated.shouldPublish) {
      console.log(`[XRadarIngestor] ✗ Tweet de ${candidate.authorHandle} descartado: ${curated.rejectionReason}`);
      return null;
    }

    // 2. Verify media resolution and status 200/206 (0 portadas estáticas inventadas)
    let verifiedImage: string | undefined = undefined;
    for (const mediaUrl of candidate.mediaUrls) {
      const ok = await this.verifyHighResImage(mediaUrl);
      if (ok) {
        verifiedImage = mediaUrl;
        break;
      }
    }

    // 3. Assemble formal dispatch. Un status id corto o sintético nunca se publica.
    const safeUrl = canonicalXLink(candidate.authorHandle, candidate.tweetUrl);
    const hash = crypto.createHash('sha256').update(safeUrl + candidate.text).digest('hex').slice(0, 8);
    const formalTitle = formatRadarHeadline(curated.title);

    const isBluesky = safeUrl.includes('bsky.app');
    const cleanHandle = candidate.authorHandle.replace('@', '');

    const newsItem: NewsItem = {
      id: `x-radar-${cleanHandle}-${hash}`,
      title: formalTitle,
      slug: `${slugify(formalTitle) || 'radar'}-${hash}`,
      lead: curated.lead,
      content: curated.content,
      summary: curated.summary,
      url: safeUrl,
      sourceName: isBluesky ? candidate.authorName : `X (${candidate.authorHandle})`,
      sourceUrl: isBluesky ? `https://bsky.app/profile/${cleanHandle}` : `https://x.com/${cleanHandle}`,
      author: candidate.authorName,
      publishedAt: candidate.createdAt || new Date().toISOString(),
      imageUrl: verifiedImage,
      category: curated.category,
      tags: curated.tags.length > 0 ? curated.tags : ['RadarX', 'Primicia', candidate.authorHandle.replace('@', '')],
      language: 'es',
      isVerified: true,
      isRadarFlash: true,
      sourceType: 'x_radar',
      twitterAuthorHandle: candidate.authorHandle,
      curatedByAi: curated.curatedByAi,
      verificationBadge: curated.verificationBadge,
    };

    // Prepend to top of list
    this.radarItems = [newsItem, ...this.radarItems.filter((i) => i.id !== newsItem.id && i.url !== newsItem.url)];
    saveNewsArticle(newsItem);
    console.log(`[XRadarIngestor] ⚡ PRIMICIA PUBLICADA: ${newsItem.title} (${candidate.authorHandle})`);
    return newsItem;
  }

  private async pollBlueskyRadar(): Promise<number> {
    const actors = [
      { actor: 'animenewsnetwork.com', name: 'ANN Radar (Bluesky)' },
      { actor: 'catsuka.bsky.social', name: 'Catsuka (Bluesky)' },
      { actor: 'myanimelist.net', name: 'MyAnimeList (Bluesky)' },
    ];
    let added = 0;

    for (const src of actors) {
      try {
        const endpoint = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(src.actor)}&limit=5`;
        const res = await fetch(endpoint, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) continue;

        const data = await res.json();
        const feed = Array.isArray(data.feed) ? data.feed : [];
        for (const entry of feed) {
          const post = entry?.post;
          const record = post?.record;
          if (!post?.uri || !record?.text || entry?.reason) continue; // omitir reposts

          const rkey = String(post.uri).split('/').pop();
          if (!rkey) continue;
          const postUrl = `https://bsky.app/profile/${src.actor}/post/${rkey}`;

          const mediaUrls: string[] = [];
          const embedImages = post.embed?.images || post.embed?.media?.images;
          if (Array.isArray(embedImages)) {
            for (const img of embedImages) {
              if (img?.fullsize) mediaUrls.push(img.fullsize);
              else if (img?.thumb) mediaUrls.push(img.thumb);
            }
          }
          if (post.embed?.thumbnail) {
            mediaUrls.push(post.embed.thumbnail);
          }
          if (post.embed?.media?.thumbnail) {
            mediaUrls.push(post.embed.media.thumbnail);
          }
          if (post.embed?.external?.thumb) {
            mediaUrls.push(post.embed.external.thumb);
          }
          if (post.embed?.media?.external?.thumb) {
            mediaUrls.push(post.embed.media.external.thumb);
          }

          const existingRadar = this.radarItems.find((item) => item.url === postUrl);
          if (existingRadar) {
            if (!existingRadar.imageUrl && mediaUrls.length > 0) {
              for (const mUrl of mediaUrls) {
                if (await this.verifyHighResImage(mUrl)) {
                  existingRadar.imageUrl = mUrl;
                  saveNewsArticle(existingRadar);
                  break;
                }
              }
            }
            continue;
          }

          const candidate: RawTweetCandidate = {
            id: rkey,
            authorHandle: `@${src.actor}`,
            authorName: src.name,
            text: String(record.text),
            createdAt: record.createdAt || post.indexedAt || new Date().toISOString(),
            mediaUrls,
            tweetUrl: postUrl,
          };

          const ingested = await this.ingestCandidate(candidate);
          if (ingested) added++;
        }
      } catch {
        // Silencioso si falla temporalmente un actor de Bluesky
      }
    }

    return added;
  }

  getRadarItems(): NewsItem[] {
    return this.radarItems;
  }

  getRadarAccounts(): XAccountConfig[] {
    return RADAR_ACCOUNTS;
  }
}

export const xRadarIngestor = new XRadarIngestor();
