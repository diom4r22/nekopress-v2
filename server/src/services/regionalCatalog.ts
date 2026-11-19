import { parse, type HTMLElement } from 'node-html-parser';
import { request, href } from './regionalHttp.js';
import { catalogCache } from './catalogCache.js';
import type { Work, Link } from './onlineCatalog.js';

export const regionalKinds = { jkanime: 'anime', tioanime: 'anime', inmanga: 'manga', olympus: 'manga' } as const;
export type Regional = keyof typeof regionalKinds;
export type Genre = '' | 'action' | 'adventure' | 'drama' | 'fantasy';
const genres = { action: 'accion', adventure: 'aventura', drama: 'drama', fantasy: 'fantasia' };
const inmangaGenres = { action: '37', adventure: '33', drama: '42', fantasy: '38' };
const jk = 'https://jkanime.net', tio = 'https://tioanime.com';
const inm = 'https://inmanga.com', oly = 'https://olympusxyz.com';
const indexes = catalogCache<Work[]>(2);
const releases = catalogCache<Link[]>(24);
const pageSize = 12;
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const slug = /^[\p{L}\p{N}_-]+$/u;

function pageOf<T>(items: T[], page: number, size = pageSize) {
  const start = size * page;
  return { items: items.slice(start, start + size), next: items.length > start + size };
}

function work(original: string, title: string | undefined, image: string, info?: string): Work[] {
  if (!original || !title?.trim()) return [];
  return [{ id: new URL(original).pathname.replace(/\/$/, '').split('/').pop()!, title: title.trim(),
    image, original, genres: [], links: [], info }];
}

function listing(root: HTMLElement, card: string, container: string) {
  if (!root.querySelector(container)) throw Error('El formato del directorio ha cambiado');
  return root.querySelectorAll(card);
}

async function jkCatalog(q: string, genre: Genre, order: string, page: number) {
  if (q) {
    const search = new URL('/buscar/' + encodeURIComponent(q), jk);
    const root = parse(await request(search));
    const items = listing(root, '.page_directorio .anime__item', '.page_directorio').flatMap(card => {
      const a = card.querySelector('h5 a');
      const image = card.querySelector('[data-setbg]')?.getAttribute('data-setbg');
      return work(href(a?.getAttribute('href'), jk), a?.text, href(image, jk, 'jkdesa.com'),
        card.querySelectorAll('.anime__item__text li').map(li => li.text.trim()).join(' · '));
    });
    return pageOf(items, page);
  }
  const url = new URL('/directorio', jk);
  url.searchParams.set('p', String(page + 1));
  if (genre) url.searchParams.set('genero', genres[genre]);
  if (order === 'popular') url.searchParams.set('filtro', 'popularidad');
  if (order === 'az') { url.searchParams.set('filtro', 'nombre'); url.searchParams.set('orden', 'asc'); }
  const html = await request(url);
  // This directory publishes its records as JSON inside a script assignment.
  const data = /^\s*var\s+animes\s*=\s*(\{[^\n]*\});\s*$/m.exec(html);
  if (!data) throw Error('Directorio de JKAnime no disponible');
  const result = JSON.parse(data[1]) as { current_page: number; last_page: number;
    data: { url: string; title: string; image: string; estado?: string; tipo?: string }[] };
  return { items: result.data.flatMap(a => work(href(a.url, jk), a.title, href(a.image, jk, 'jkdesa.com'), [a.tipo,a.estado].filter(Boolean).join(' · '))),
    next: result.current_page < result.last_page };
}

async function tioCatalog(q: string, genre: Genre, order: string, page: number) {
  const url = new URL('/directorio', tio);
  url.searchParams.set('p', String(page + 1));
  if (q) url.searchParams.set('q', q);
  if (genre) url.searchParams.set('genero[]', genres[genre]);
  if (order === 'oldest') url.searchParams.set('sort', '-recent');
  const root = parse(await request(url));
  const items = listing(root, 'article.anime', 'main').flatMap(card => {
    const original = href(card.querySelector('a')?.getAttribute('href'), tio);
    if (!original.startsWith(tio + '/anime/')) return [];
    return work(original, card.querySelector('.title')?.text, href(card.querySelector('img')?.getAttribute('src'), tio));
  });
  return { items, next: !!root.querySelector('.pagination a[rel="next"]') };
}

async function inmCatalog(q: string, genre: Genre, order: string, page: number) {
  const sort = order === 'az' ? '5' : order === 'recent' ? '3' : '1';
  const body = new URLSearchParams({ 'filter[queryString]': q, 'filter[skip]': String(page * pageSize),
    'filter[take]': String(pageSize + 1), 'filter[onlyFavorites]': 'false', 'filter[broadcastStatus]': '0',
    'filter[generes][]': genre ? inmangaGenres[genre] : '-1', 'filter[sortby]': sort });
  const root = parse(await request(new URL('/manga/getMangasConsultResult', inm), body));
  const rows = listing(root, 'a.manga-result', '#favoriteMangaAlert');
  const items = rows.slice(0, pageSize).flatMap(card => {
    const original = href(card.getAttribute('href'), inm);
    if (!original.startsWith(inm + '/ver/manga/')) return [];
    const count = card.querySelector('.bt-i .label')?.text.trim();
    const info = [card.querySelector('.label-danger')?.text.trim(), count && count + ' capítulos'].filter(Boolean).join(' · ');
    return work(original, card.querySelector('.ellipsed-text')?.text,
      href(card.querySelector('img')?.getAttribute('data-src'), inm, 'intomanga.com'), info);
  });
  return { items, next: rows.length > pageSize };
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
async function olympusCatalog(q: string, order: string, page: number) {
  const index = await indexes.read('olympus', async () => {
    const result = JSON.parse(await request(new URL('/api/series/list', oly))) as {
      data: { name: string; slug: string; cover?: string; type: string }[] };
    return result.data.filter(s => s.type === 'comic' && slug.test(s.slug)).flatMap(s =>
      work(oly + '/series/comic-' + s.slug, s.name, href(s.cover, oly, 'imagesolymp.xyz')))
      .sort((a,b) => collator.compare(a.title,b.title));
  });
  const terms = normalize(q).split(/\s+/).filter(Boolean);
  const matches = index.filter(w => terms.every(t => normalize(w.title).includes(t)));
  if (order === 'za') matches.reverse();
  return pageOf(matches, page);
}

export function regionalCatalog(source: Regional, q: string, genre: Genre, order: string, page: number) {
  switch (source) {
    case 'jkanime': return jkCatalog(q, genre, order, page);
    case 'tioanime': return tioCatalog(q, genre, order, page);
    case 'inmanga': return inmCatalog(q, genre, order, page);
    case 'olympus': return olympusCatalog(q, order, page);
  }
}

export function validReleaseId(source: string, id: string, series: string) {
  if (source === 'tioanime') return slug.test(id) && id.length <= 240;
  return source === 'inmanga' && uuid.test(id) && !!series && series.length <= 240 &&
    series !== '.' && series !== '..' && !/[\\/\x00-\x1f]/.test(series);
}

export async function regionalReleases(source: string, id: string, series: string, page: number) {
  const all = await releases.read(JSON.stringify([source, id, series]), async () => {
    if (source === 'tioanime') {
      const html = await request(new URL('/anime/' + encodeURIComponent(id), tio));
      const episodes = /^\s*var\s+episodes\s*=\s*(\[[\d.,\s]*\]);/m.exec(html);
      if (!episodes) throw Error('Lista de episodios no disponible');
      const numbers: number[] = JSON.parse(episodes[1]);
      return [...new Set(numbers)].filter(Number.isFinite).sort((a,b) => a-b)
        .map(n => ({ label: 'Episodio ' + n, episode: n, url: tio + '/ver/' + encodeURIComponent(id) + '-' + n }));
    }
    const url = new URL('/chapter/getall', inm);
    url.searchParams.set('mangaIdentification', id);
    const envelope = JSON.parse(await request(url));
    const contents = JSON.parse(envelope.data) as { success: boolean; result: {
      Number: number; Identification: string; FriendlyChapterNumberUrl: string }[] };
    if (!contents.success) throw Error('Lista de capítulos no disponible');
    return contents.result.filter(c => uuid.test(c.Identification) && Number.isFinite(c.Number) && c.FriendlyChapterNumberUrl)
      .sort((a,b) => a.Number - b.Number).map(c => ({ label: 'Capítulo ' + c.Number, chapterId: c.Identification.toLowerCase(),
        url: inm + '/ver/manga/' + encodeURIComponent(series) + '/' + encodeURIComponent(c.FriendlyChapterNumberUrl) + '/' + c.Identification }));
  });
  return pageOf(all, page, 30);
}
