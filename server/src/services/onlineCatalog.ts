import express from 'express';
import { catalogCache } from './catalogCache.js';
import { regionalCatalog, regionalKinds, regionalReleases, validReleaseId, type Regional } from './regionalCatalog.js';
import { regionalPlayback } from './regionalPlayback.js';
import { readFileSync } from 'node:fs';

const genres = {
  action: ['Acción', '391b0423-d847-456f-aff0-8b0cfc03066b'],
  adventure: ['Aventura', '87cc87cd-a395-47af-b27a-93258283bbc6'],
  drama: ['Drama', 'b9af3a63-f058-46de-a9a0-e0c13906197a'],
  fantasy: ['Fantasía', 'cdc58593-87dd-415e-bbc0-2ec27bf404cc'],
} as const;
type Genre = keyof typeof genres;
type Kind = 'anime' | 'manga';
export type Link = { label: string; url: string; chapterId?: string; episode?: number; groups?: { name: string; url: string }[] };
export interface Work {
  info?: string; searchTitle?: string;
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
const cache = catalogCache<Page | Chapters>(150);

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
    return { id: e.id, title: a.titles?.en || a.canonicalTitle, searchTitle: a.titles?.en_jp || a.canonicalTitle, image: webLink(a.posterImage?.medium || a.posterImage?.small),
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
  url.searchParams.set('includes[]', 'scanlation_group');
  for (const lang of english ? ['en'] : ['es', 'es-la']) url.searchParams.append('translatedLanguage[]', lang);
  const d = await json<{ total: number; data: { id: string; relationships?: {
    type: string; id: string; attributes?: { name?: string; website?: string }
  }[]; attributes: { title?: string; volume?: string; chapter?: string; pages: number; externalUrl?: string; translatedLanguage: string } }[] }>(url);
  return { next: (page + 1) * chapterLimit < Math.min(10000, d.total), items: d.data.flatMap(c => {
    const a = c.attributes, external = webLink(a.externalUrl);
    if (!external && !a.pages) return [];
    const label = [a.volume && 'Vol. ' + a.volume, a.chapter && 'Cap. ' + a.chapter, a.title].filter(Boolean).join(' · ') || 'Capítulo único';
    const groups = c.relationships?.flatMap(group => {
      const name = group.attributes?.name;
      if (group.type !== 'scanlation_group' || !name || !uuid.test(group.id)) return [];
      return [{ name, url: webLink(group.attributes?.website) || 'https://mangadex.org/group/' + group.id }];
    });
    return [{ label: label + ' · ' + a.translatedLanguage.toUpperCase(), groups, url: external || 'https://mangadex.org/chapter/' + c.id, chapterId: external ? undefined : c.id }];
  }) };
}

export const onlineCatalog = express.Router();
onlineCatalog.use(regionalPlayback);
onlineCatalog.get('/:kind', async (req, res) => {
  const { kind } = req.params;
  const q = String(req.query.q || '').trim(), genre = String(req.query.genre || ''), rated = req.query.sort === 'rating';
  const page = Number(req.query.page || 0);
  if (!['anime','manga'].includes(kind) || (genre && !Object.hasOwn(genres, genre)) || q.length > 100 ||
      !Number.isSafeInteger(page) || page < 0 || page * limit >= 10000) { res.sendStatus(400); return; }
  const primary = kind === 'anime' ? 'kitsu' : 'mangadex';
  const source = String(req.query.source || primary);
  const order = String(req.query.sort || 'popular');
  if (source !== primary && (!Object.hasOwn(regionalKinds, source) || regionalKinds[source as Regional] !== kind)) {
    res.status(400).json({ error: 'Fuente no disponible para esta colección.' }); return;
  }
  const key = JSON.stringify([kind, source, q, genre, order, page]);
  try {
    const data = await cache.read(key, () => source === primary
      ? (kind === 'anime' ? anime : manga)(q, genre as Genre | '', rated, page)
      : regionalCatalog(source as Regional, q, genre as Genre | '', order, page));
    res.json(data);
  }
  catch {
    let fallback = cache.previous(key);
    if (!fallback && source === primary && !q && !genre && !rated && page === 0) {
      try { fallback = JSON.parse(readFileSync(new URL('../../data/catalog-selection.json', import.meta.url), 'utf8'))[kind as Kind]; } catch { /* First installation without a selection */ }
    }
    if (fallback) res.json({ ...fallback, saved: true }); else res.status(503).json({ error: 'La fuente no responde. Vuelve a intentarlo.' });
  }
});
onlineCatalog.get('/fuente/:source/:id/entregas', async (req, res) => {
  const { source, id } = req.params, series = String(req.query.serie || ''), page = Number(req.query.page || 0);
  if (!validReleaseId(source, id, series) || !Number.isSafeInteger(page) || page < 0 || page >= 1000) {
    res.sendStatus(400); return;
  }
  try { res.json(await regionalReleases(source, id, series, page)); }
  catch { res.status(503).json({ error: 'La fuente no pudo cargar las entregas.' }); }
});
onlineCatalog.get('/manga/:id/capitulos', async (req, res) => {
  const id = req.params.id, page = Number(req.query.page || 0), english = req.query.lang === 'en';
  if (!uuid.test(id) || !Number.isSafeInteger(page) || page < 0 || page * chapterLimit >= 10000) { res.sendStatus(400); return; }
  try { res.json(await cache.read(JSON.stringify([id,page,english]), () => chapters(id, page, english))); }
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
