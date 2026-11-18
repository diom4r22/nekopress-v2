import type { NewsItem } from '../types.js';

export function headline(title: string) {
  return title.replace(/^(?:⚡\s*)?(?:radar x|despacho flash)\s*:\s*/i, '').trim();
}

export function videoId(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1)
      : ['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname) && url.pathname === '/watch'
      ? url.searchParams.get('v') : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

export function storyText(item: NewsItem) {
  const title = headline(item.title);
  const clean = (s: string) => headline(s).replace(/\s*(?:La publicación|La entrada) .+? (?:apareció|se publicó) primero en .+$/i, '').trim();
  const usable = (s: string) => s.length > 0 && s.toLowerCase() !== title.toLowerCase()
    && !/^(?:Despacho verificado emitido por|El reporte oficial proviene del canal especializado|Los detalles de producción, el elenco)/i.test(s);
  const body = (item.content ?? '').split(/\n\s*\n/).map(clean).filter(usable);
  const excerpt = [item.summary, item.lead, ...body].map(s => clean(s || '')).find(usable);
  const intro = excerpt && excerpt.length > 290 ? excerpt.slice(0, 286).replace(/\s+\S*$/, '') + '…' : excerpt;
  return { title, intro, body: body.filter(s => s !== intro) };
}
