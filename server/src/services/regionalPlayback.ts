import express from 'express';
import { parse } from 'node-html-parser';
import { catalogCache } from './catalogCache.js';
import { request, href } from './regionalHttp.js';

type Player = { label: string; url: string };
const players = catalogCache<Player[]>(50, 90_000);
const manifests = catalogCache<string[]>(50);
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const inm = 'https://inmanga.com';
const jk = 'https://jkanime.net';
const tio = 'https://tioanime.com';

// These providers publish iframe URLs with specific player paths.
// Episode pages, advertising frames and unrelated hosts are not player origins.
const tioEmbeds: Record<string, { path: string; name: string; rank: number }> = {
  'www.yourupload.com': { path: '/embed/', name: 'YourUpload', rank: 1 },
  'ok.ru': { path: '/videoembed/', name: 'OK', rank: 2 },
  'mega.nz': { path: '/embed/', name: 'MEGA', rank: 3 },
  'v.tioanime.com': { path: '/embed.php', name: 'TíoAnime', rank: 4 },
  'www.youtube.com': { path: '/embed/', name: 'YouTube', rank: 1 },
};

function tioPlayers(html: string): Player[] {
  const list = /\bvar\s+videos\s*=\s*(\[[^\n]*\])\s*;/.exec(html);
  if (!list) return [];
  const rows: unknown = JSON.parse(list[1]);
  if (!Array.isArray(rows)) return [];
  const available = rows.flatMap(row => {
    if (!Array.isArray(row) || typeof row[1] !== 'string') return [];
    let url: URL;
    try { url = new URL(row[1]); } catch { return []; }
    const provider = tioEmbeds[url.hostname];
    if (!provider || url.protocol !== 'https:' || url.username || url.password || url.port) return [];
    const matches = provider.path.endsWith('/') ? url.pathname.startsWith(provider.path) : url.pathname === provider.path;
    if (!matches) return [];
    return [{ label: provider.name, url: url.href, rank: provider.rank }];
  }).sort((a,b) => a.rank - b.rank);
  return [...new Map(available.map(p => [p.url, { label: p.label, url: p.url }])).values()];
}

function jkPlayers(html: string): Player[] {
  const doc = parse(html);
  const preferred = /\bvar\s+video_data\s*=\s*video\[(\d+)\]/.exec(html)?.[1];
  const options = new Map<string, Player>();
  for (const match of html.matchAll(/\bvideo\[(\d+)\]\s*=\s*'(<iframe\b[^'\n]*<\/iframe>)'/gi)) {
    const raw = parse(match[2]).querySelector('iframe.player_conte')?.getAttribute('src');
    const url = href(raw, jk);
    if (!url.startsWith(jk + '/jkplayer/')) continue;
    const label = doc.querySelector('a.servers[data-id="' + match[1] + '"]')?.text.trim() || 'JKAnime';
    options.set(match[1], { label, url });
  }
  const first = preferred ? options.get(preferred) : undefined;
  const ordered = first ? [first, ...options.values()] : [...options.values()];
  return [...new Map(ordered.map(p => [p.url, p])).values()];
}

async function inmangaPages(chapterId: string) {
  const controls = new URL('/chapter/chapterIndexControls', inm);
  controls.searchParams.set('identification', chapterId);
  const doc = parse(await request(controls));
  const value = (id: string) => doc.querySelector('#' + id)?.getAttribute('value') || '';
  const serie = value('FriendlyMangaName'), number = value('FriendlyChapterNumberUrl');
  if (value('ChapterIdentification').toLowerCase() !== chapterId || !serie || !number ||
      [serie, number].some(s => s === '.' || s === '..' || /[\\/]/.test(s))) return [];
  const episode = new URL('/ver/manga/' + [serie, number, chapterId].map(encodeURIComponent).join('/'), inm);
  const html = await request(episode);
  const template = /\bvar\s+pu\s*=\s*['"]([^'"]+)['"]/.exec(html)?.[1];
  if (!template?.includes('identification')) throw Error('El capítulo no publicó imágenes.');
  const rows = doc.querySelectorAll('img.ImageContainer[data-pagenumber]').flatMap(img => {
    const id = img.getAttribute('id') || '', page = Number(img.getAttribute('data-pagenumber'));
    if (!uuid.test(id) || !Number.isSafeInteger(page) || page < 1) return [];
    const url = href(template.replace('identification', id).replace('pageNumber', String(page)), inm, 'intomanga.com');
    return url ? [{ page, url }] : [];
  }).sort((a,b) => a.page - b.page);
  return [...new Set(rows.map(r => r.url))];
}

export const regionalPlayback = express.Router();
regionalPlayback.get('/lectura/inmanga/:id/paginas', async (req, res) => {
  const id = req.params.id.toLowerCase();
  if (!uuid.test(id)) { res.sendStatus(400); return; }
  try { res.json({ pages: await manifests.read(id, () => inmangaPages(id)) }); }
  catch { res.status(503).json({ error: 'No se pudieron cargar las páginas de InManga.' }); }
});

regionalPlayback.get('/reproductor/:source/:serie/:episodio', async (req, res) => {
  const { source, serie, episodio } = req.params;
  if (!['tioanime', 'jkanime'].includes(source) || !/^[\p{L}\p{N}_-]{1,240}$/u.test(serie) ||
      !/^\d{1,5}(?:\.\d{1,2})?$/.test(episodio)) { res.sendStatus(400); return; }
  const url = source === 'jkanime' ? new URL('/' + encodeURIComponent(serie) + '/' + episodio + '/', jk)
    : new URL('/ver/' + encodeURIComponent(serie) + '-' + episodio, tio);
  try {
    const options = await players.read(url.href, async () => {
      const html = await request(url);
      return source === 'jkanime' ? jkPlayers(html) : tioPlayers(html);
    });
    res.set('Cache-Control', 'no-store').json({ players: options });
  } catch { res.status(503).json({ error: 'La fuente no respondió para este episodio.' }); }
});
