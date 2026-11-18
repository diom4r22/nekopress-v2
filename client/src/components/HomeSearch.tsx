import React, { useMemo, useState } from 'react';
import type { AnimeItem, NewsItem, ScheduleItem } from '../types.js';
import { searchable, titles, trailerLookup } from '../lib/discovery.js';
import { broadcastInstant } from '../lib/scheduleClock.js';
import { headline, videoId } from '../lib/story.js';

interface Result { id: string; title: string; detail: string; open: () => void }

function ResultsGroup({ title, rows }: { title: string; rows: Result[] }) {
  const [limit, setLimit] = useState(6);
  if (!rows.length) return null;
  return <section className="border-t border-white/20 py-4">
    <h2 className="mb-2 font-serif text-2xl font-bold">{title} <small className="font-sans text-sm text-zinc-400">{rows.length}</small></h2>
    <ul className="divide-y divide-white/10">{rows.slice(0, limit).map(row => <li key={row.id}>
      <button className="w-full py-3 text-left hover:text-red-300" onClick={row.open}>
        <span className="block font-semibold">{row.title}</span><span className="text-xs text-zinc-400">{row.detail}</span>
      </button></li>)}</ul>
    {rows.length > limit && <button className="mt-2 text-sm text-red-300 underline" onClick={() => setLimit(limit + 12)}>Mostrar más {title.toLowerCase()}</button>}
  </section>;
}

interface Props {
  query: string; news: NewsItem[]; catalog: AnimeItem[]; schedule: ScheduleItem[];
  onArticle: (item: NewsItem) => void; onAnime: (item: AnimeItem) => void;
  onAnimeId: (id: number) => void; onCalendar: () => void; loading: boolean;
}

export function HomeSearch({ query, news, catalog, schedule, onArticle, onAnime, onAnimeId, onCalendar, loading }: Props) {
  const lookup = useMemo(() => trailerLookup(catalog), [catalog]);
  const words = searchable(query).split(' ').filter(Boolean);
  function matches(values: string[]) {
    const text = searchable(values.join(' '));
    return words.length > 0 && words.every(word => text.includes(word));
  }
  const articles: Result[] = [], videos: Result[] = [];
  for (const item of news) {
    const video = videoId(item.url);
    const anime = video && lookup(item);
    if (matches([headline(item.title), item.summary, item.sourceName, item.category, ...item.tags, ...(anime ? titles(anime) : [])])) {
      (video ? videos : articles).push({ id: item.id, title: headline(item.title), detail: item.sourceName, open: () => onArticle(item) });
    }
  }
  const dossiers = catalog.filter(item => matches([...titles(item), ...item.studios, ...item.genres]))
    .map(item => ({ id: String(item.id), title: item.title, detail: [item.format, item.year, item.status].filter(Boolean).join(' · '), open: () => onAnime(item) }));
  const now = new Date();
  const dates = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  const airings: Result[] = [];
  for (const item of schedule) {
    const instant = broadcastInstant(item, now);
    const when = instant ? dates.format(instant) : 'Hora por confirmar';
    const detail = [when, item.currentEpisode ? 'Ep. ' + item.currentEpisode : '', item.platform].filter(Boolean).join(' · ');
    if (matches([...titles(item), detail])) airings.push({ id: item.id, title: item.title, detail,
      open: () => item.animeId ? onAnimeId(item.animeId) : onCalendar() });
  }
  const groups = [{ title: 'Fichas', rows: dossiers }, { title: 'Videos', rows: videos }, { title: 'Noticias', rows: articles }, { title: 'Emisiones', rows: airings }];
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  return <div className="w-full px-6 pb-8 pt-4 text-white lg:px-10">
    <h1 className="font-serif text-3xl font-bold">Resultados de búsqueda</h1>
    <p role="status" className="my-3 text-sm text-zinc-300">{total ? `${total} resultados para «${query}»` : loading ? 'Buscando…' : `Sin resultados para «${query}»`}</p>
    <div className="grid gap-x-10 md:grid-cols-2">{groups.map(group => <ResultsGroup key={group.title + query} {...group} />)}</div>
  </div>;
}
