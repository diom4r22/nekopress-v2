import express from 'express';
import { readFileSync } from 'node:fs';

const genres = {
  action: ['Acción', '391b0423-d847-456f-aff0-8b0cfc03066b'],
  adventure: ['Aventura', '87cc87cd-a395-47af-b27a-93258283bbc6'],
  drama: ['Drama', 'b9af3a63-f058-46de-a9a0-e0c13906197a'],
  fantasy: ['Fantasía', 'cdc58593-87dd-415e-bbc0-2ec27bf404cc'],
} as const;
type Genre = keyof typeof genres;
type Kind = 'anime' | 'manga';
type Link = { label: string; url: string; chapterId?: string };
interface Work {
  id: string; title: string; image: string; genres: string[]; year?: number; original: string; links: Link[];
}
interface Page { items: Work[]; next: boolean }
interface Chapters { items: Link[]; next: boolean }
interface Entity<A> { id: string; type: string; attributes: A; relationships?: Record<string, { data?: Ref[] | Ref }> }
type Ref = { id: string; type: string };
interface AnimeAttrs {
  canonicalTitle: string; titles: Record<string, string>; startDate?: string;
  posterImage?: { small?: string; medium?: string }; slug: string; ageRating?: string; nsfw?: boolean;
}
interface Manga {
  id: string; attributes: { title: Record<string, string>; altTitles: Record<string,string>[];
    tags: { attributes: { group: string; name: { en: string } } }[]; year?: number };
  relationships: { type: string; attributes?: { fileName?: string } }[];
}

function webLink(value?: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.href;
  } catch { return ''; }
}
const genreNames: Record<string, string> = { comedy: 'Comedia', horror: 'Terror', mystery: 'Misterio', romance: 'Romance',
  'sci-fi': 'Ciencia ficción', 'slice of life': 'Vida cotidiana', sports: 'Deportes', thriller: 'Suspenso', psychological: 'Psicológico',
  historical: 'Histórico', supernatural: 'Sobrenatural', 'magical girls': 'Chicas mágicas', 'girls’ love': 'Romance entre chicas' };
const translate = (name: string) => genres[name.toLowerCase() as Genre]?.[0] || genreNames[name.toLowerCase()] || name;
const limit = 12;
const chapterLimit = 30;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const cache = new Map<string, { data: Page | Chapters; until: number }>();
const pending = new Map<string, Promise<Page | Chapters>>();

async function cached(key: string, load: () => Promise<Page | Chapters>) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.data;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = load().then(data => {
    cache.delete(key);
    if (cache.size >= 150) cache.delete(cache.keys().next().value!);
    cache.set(key, { data, until: Date.now() + 10 * 60000 });
    return data;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

async function json<T>(url: URL): Promise<T> {
  const response = await fetch(url, { headers: { Accept: url.hostname === 'kitsu.io' ? 'application/vnd.api+json' : 'application/json', 'User-Agent': 'NekoPress/2.0' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error('Fuente no disponible');
  return response.json() as Promise<T>;
}

async function anime(search: string, genre: Genre | '', rated: boolean, page: number): Promise<Page> {
  const url = new URL('https://kitsu.io/api/edge/anime');
  url.search = new URLSearchParams({ 'page[limit]': String(limit), 'page[offset]': String(page * limit),
    sort: rated ? '-averageRating' : '-userCount', include: 'categories,streamingLinks.streamer' }).toString();
  if (search) url.searchParams.set('filter[text]', search);
  if (genre) url.searchParams.set('filter[categories]', genre);
  const d = await json<{ data: Entity<AnimeAttrs>[]; links: { next?: string }; included?: Entity<{ title?: string; url?: string; siteName?: string }>[] }>(url);
  const refs = new Map(d.included?.map(e => [e.type + ':' + e.id, e]));
  function related(ref: Ref | Ref[] | undefined) {
    const list = !ref ? [] : Array.isArray(ref) ? ref : [ref];
    return list.flatMap(r => refs.get(r.type + ':' + r.id) || []);
  }
  const items = d.data.filter(e => !e.attributes.nsfw && e.attributes.ageRating !== 'R18').map(e => {
    const a = e.attributes;
    const tags = related(e.relationships?.categories?.data).map(t => t.attributes.title || '').filter(t => Object.hasOwn(genres,t.toLowerCase()) || Object.hasOwn(genreNames,t.toLowerCase()));
    const links = related(e.relationships?.streamingLinks?.data).flatMap(l => {
      const url = webLink(l.attributes.url);
      const name = related(l.relationships?.streamer?.data)[0]?.attributes.siteName;
      return url ? [{ label: name || new URL(url).hostname, url }] : [];
    });
    return { id: e.id, title: a.titles?.en || a.canonicalTitle, image: webLink(a.posterImage?.medium || a.posterImage?.small),
      genres: tags.map(translate), year: Number(a.startDate?.slice(0,4)) || undefined,
      original: 'https://kitsu.app/anime/' + encodeURIComponent(a.slug), links: [...new Map(links.map(l => [l.url, l])).values()] };
  });
  return { items, next: !!d.links.next && page < 833 };
}

async function manga(search: string, genre: Genre | '', rated: boolean, page: number): Promise<Page> {
  const url = new URL('https://api.mangadex.org/manga');
  url.search = new URLSearchParams({ limit: String(Math.min(limit, 10000 - page * limit)), offset: String(page * limit), 'includes[]': 'cover_art',
    'contentRating[]': 'safe', [rated ? 'order[rating]' : 'order[followedCount]']: 'desc' }).toString();
  for (const lang of ['es', 'es-la']) url.searchParams.append('availableTranslatedLanguage[]', lang);
  if (search) url.searchParams.set('title', search);
  if (genre) url.searchParams.set('includedTags[]', genres[genre][1]);
  const d = await json<{ data: Manga[]; total: number }>(url);
  return { next: (page + 1) * limit < Math.min(10000, d.total), items: d.data.map(m => {
    const a = m.attributes, file = m.relationships.find(r => r.type === 'cover_art')?.attributes?.fileName;
    const names = [a.title, ...a.altTitles];
    const title = ['es', 'es-la', 'en'].map(lang => names.find(n => n[lang])?.[lang]).find(Boolean) || Object.values(a.title)[0];
    return { id: m.id, title, image: file ? 'https://uploads.mangadex.org/covers/' + m.id + '/' + encodeURIComponent(file) + '.256.jpg' : '',
      genres: a.tags.filter(t => t.attributes.group === 'genre').map(t => translate(t.attributes.name.en)),
      year: a.year, original: 'https://mangadex.org/title/' + m.id, links: [] };
  }) };
}

async function chapters(id: string, page: number, english: boolean): Promise<Chapters> {
  const url = new URL('https://api.mangadex.org/manga/' + id + '/feed');
  url.search = new URLSearchParams({ limit: String(Math.min(chapterLimit, 10000 - page * chapterLimit)), offset: String(page * chapterLimit), 'order[volume]': 'asc', 'order[chapter]': 'asc' }).toString();
  for (const lang of english ? ['en'] : ['es', 'es-la']) url.searchParams.append('translatedLanguage[]', lang);
  const d = await json<{ total: number; data: { id: string; attributes: { title?: string; volume?: string; chapter?: string; pages: number; externalUrl?: string; translatedLanguage: string } }[] }>(url);
  return { next: (page + 1) * chapterLimit < Math.min(10000, d.total), items: d.data.flatMap(c => {
    const a = c.attributes, external = webLink(a.externalUrl);
    if (!external && !a.pages) return [];
    const label = [a.volume && 'Vol. ' + a.volume, a.chapter && 'Cap. ' + a.chapter, a.title].filter(Boolean).join(' · ') || 'Capítulo único';
    return [{ label: label + ' · ' + a.translatedLanguage.toUpperCase(), url: external || 'https://mangadex.org/chapter/' + c.id, chapterId: external ? undefined : c.id }];
  }) };
}

export const onlineCatalog = express.Router();
onlineCatalog.get('/:kind', async (req, res) => {
  const { kind } = req.params;
  const q = String(req.query.q || '').trim(), genre = String(req.query.genre || ''), rated = req.query.sort === 'rating';
  const page = Number(req.query.page || 0);
  if (!['anime','manga'].includes(kind) || (genre && !Object.hasOwn(genres, genre)) || q.length > 100 ||
      !Number.isSafeInteger(page) || page < 0 || page * limit >= 10000) { res.sendStatus(400); return; }
  const key = JSON.stringify([kind, q, genre, rated, page]);
  try { res.json(await cached(key, () => (kind === 'anime' ? anime : manga)(q, genre as Genre | '', rated, page))); }
  catch {
    let fallback = cache.get(key)?.data;
    if (!fallback && !q && !genre && !rated && page === 0) {
      try { fallback = JSON.parse(readFileSync(new URL('../../data/catalog-selection.json', import.meta.url), 'utf8'))[kind as Kind]; } catch { /* First installation without a selection */ }
    }
    if (fallback) res.json({ ...fallback, saved: true }); else res.status(503).json({ error: 'La fuente no responde. Vuelve a intentarlo.' });
  }
});
onlineCatalog.get('/manga/:id/capitulos', async (req, res) => {
  const id = req.params.id, page = Number(req.query.page || 0), english = req.query.lang === 'en';
  if (!uuid.test(id) || !Number.isSafeInteger(page) || page < 0 || page * chapterLimit >= 10000) { res.sendStatus(400); return; }
  try { res.json(await cached(JSON.stringify([id,page,english]), () => chapters(id, page, english))); }
  catch { res.status(503).json({ error: 'No se pudieron cargar los capítulos.' }); }
});


const manifests = new Map<string, { until: number; pages: string[] }>();
async function chapterPages(id: string, refresh = false) {
  const previous = manifests.get(id);
  if (!refresh && previous && previous.until > Date.now()) return previous.pages;
  const d = await json<{ baseUrl: string; chapter: { hash: string; dataSaver: string[] } }>(
    new URL('https://api.mangadex.org/at-home/server/' + id));
  const base = new URL(d.baseUrl);
  if (base.protocol !== 'https:' || base.username || base.password ||
      !/(^|\.)(mangadex\.org|mangadex\.network)$/.test(base.hostname)) throw Error('Servidor de páginas inválido');
  const pages = d.chapter.dataSaver.map(file => new URL('data-saver/' + encodeURIComponent(d.chapter.hash) + '/' +
    encodeURIComponent(file), base.href.replace(/\/?$/, '/')).href);
  if (manifests.size >= 100) manifests.delete(manifests.keys().next().value!);
  manifests.set(id, { until: Date.now() + 60_000, pages });
  return pages;
}

async function downloadPage(url: string) {
  const start = Date.now();
  let bytes = 0, cached = false, success = false;
  try {
    const r = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    cached = r.headers.get('x-cache')?.startsWith('HIT') ?? false;
    const type = r.headers.get('content-type')?.split(';')[0];
    if (!r.ok || !type || !['image/png','image/jpeg','image/webp','image/avif','image/gif'].includes(type)) {
      await r.body?.cancel(); throw Error('Imagen no disponible');
    }
    const body = Buffer.from(await r.arrayBuffer());
    bytes = body.length;
    if (!bytes) throw Error('Imagen vacía');
    success = true;
    return { body, type };
  } finally {
    if (new URL(url).hostname.endsWith('.mangadex.network')) {
      void fetch('https://api.mangadex.network/report', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, success, bytes, cached, duration: Date.now() - start }), signal: AbortSignal.timeout(5000) })
        .then(r => r.body?.cancel()).catch(() => {});
    }
  }
}

onlineCatalog.get('/capitulo/:id/paginas', async (req, res) => {
  const { id } = req.params;
  if (!uuid.test(id)) { res.sendStatus(400); return; }
  try {
    const pages = await chapterPages(id);
    res.json({ pages: pages.map((_, i) => req.baseUrl + '/capitulo/' + id + '/pagina/' + (i + 1)) });
  } catch { res.status(503).json({ error: 'No se pudieron cargar las páginas de MangaDex.' }); }
});

onlineCatalog.get('/capitulo/:id/pagina/:n', async (req, res) => {
  const { id, n } = req.params, index = Number(n) - 1;
  if (!uuid.test(id) || !Number.isSafeInteger(index) || index < 0) { res.sendStatus(400); return; }
  try {
    const pages = await chapterPages(id);
    if (!pages[index]) { res.sendStatus(404); return; }
    let image;
    try { image = await downloadPage(pages[index]); }
    catch {
      const fresh = await chapterPages(id, true);
      if (!fresh[index]) { res.sendStatus(404); return; }
      image = await downloadPage(fresh[index]);
    }
    res.set({ 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' }).type(image.type).send(image.body);
  } catch { res.status(503).json({ error: 'No se pudo cargar la página.' }); }
});
