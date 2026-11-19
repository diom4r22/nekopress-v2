import React, { useEffect, useRef, useState } from 'react';
import { MangaReader } from './MangaReader.js';
import { PosterImage } from './PosterImage.js';

type Kind = 'anime' | 'manga';
type Link = { label: string; url: string; chapterId?: string; episode?: number; groups?: { name: string; url: string }[] };
type Work = { id: string; title: string; image: string; genres: string[]; year?: number; original: string; info?: string; searchTitle?: string; links: Link[] };
type Page<T> = { items: T[]; next: boolean; saved?: boolean };
const api = '/api/catalogo-online/';
const control = 'min-h-10 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-40';
const action = control + ' hover:border-red-400';
const field = 'grid gap-1 text-xs font-semibold text-zinc-300';

interface Source {
  id: string; name: string; directory: string; genres?: boolean; sorts: [string, string][];
}
const rankings: [string, string][] = [['popular','Popularidad'], ['rating','Valoración']];
const sources: Record<Kind, Source[]> = {
  anime: [
    { id: 'jkanime', name: 'JKAnime', directory: 'https://jkanime.net/directorio', genres: true,
      sorts: [['popular','Popularidad'], ['recent','Más recientes'], ['az','Título A–Z']] },
    { id: 'tioanime', name: 'TíoAnime', directory: 'https://tioanime.com/directorio', genres: true,
      sorts: [['recent','Más recientes'], ['oldest','Más antiguos']] },
    { id: 'kitsu', name: 'Kitsu', directory: 'https://kitsu.app/explore/anime', sorts: rankings, genres: true },
  ],
  manga: [
    { id: 'inmanga', name: 'InManga', directory: 'https://inmanga.com/manga/consult', genres: true,
      sorts: [['popular','Más vistos'], ['recent','Última actualización'], ['az','Título A–Z']] },
    { id: 'mangadex', name: 'MangaDex', directory: 'https://mangadex.org/titles', sorts: rankings, genres: true },
    { id: 'olympus', name: 'Olympus Scanlation', directory: 'https://olympusxyz.com/series', sorts: [['az','Título A–Z'], ['za','Título Z–A']] },
  ],
};

function useResource<T>(path: string) {
  const [record, setRecord] = useState<{ path: string; data?: T; error?: string }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setRecord({ path });
    fetch(path, { signal: abort.signal }).then(async response => {
      if (!response.ok) throw Error();
      const data = await response.json() as T;
      if (!abort.signal.aborted) setRecord({ path, data });
    }).catch(() => { if (!abort.signal.aborted) setRecord({ path, error: 'La fuente no responde en este momento.' }); });
    return () => abort.abort();
  }, [path, attempt]);
  return { ...(record?.path === path ? record : {}), retry: () => setAttempt(a => a + 1) };
}

function Feedback({ error, retry }: { error?: string; retry: () => void }) {
  return <div role="status" className="py-4 text-sm text-zinc-300">{error || 'Cargando…'} {error && <button className="underline" onClick={retry}>Reintentar</button>}</div>;
}
function Pager({ page, next, onPage }: { page: number; next: boolean; onPage: (page: number) => void }) {
  if (!page && !next) return null;
  return <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
    <button className={action} disabled={!page} onClick={() => onPage(page - 1)}>Anterior</button>
    <span className="text-sm text-zinc-400">Página {page + 1}</span>
    <button className={action} disabled={!next} onClick={() => onPage(page + 1)}>Siguiente</button>
  </div>;
}

function OnlineReader({ chapter, source = 'mangadex' }: { chapter: Link; source?: 'inmanga' | 'mangadex' }) {
  const key = 'nekopress.' + source + '.' + chapter.chapterId;
  const path = source === 'inmanga' ? 'lectura/inmanga/' : 'capitulo/';
  const manifest = useResource<{ pages: string[] }>(api + path + chapter.chapterId + '/paginas');
  return <section className="space-y-3"><h4 className="font-semibold">{chapter.label}</h4>
    <a className="text-sm text-red-300 underline" target="_blank" rel="noreferrer" href={chapter.url}>Abrir en {source === 'inmanga' ? 'InManga' : 'MangaDex'} ↗</a>
    {!manifest.data ? <Feedback {...manifest} /> : <MangaReader key={key} pages={manifest.data.pages} storageKey={key} />}
  </section>;
}

function EpisodePlayer({ source, serie, episode }: { source: Source; serie: Work; episode: number }) {
  const response = useResource<{ players: Link[] }>(api + 'reproductor/' + source.id + '/' + encodeURIComponent(serie.id) + '/' + episode);
  const [choice, setChoice] = useState(0);
  const [reload, setReload] = useState(0);
  const options = response.data?.players, selected = options?.[choice];
  return <section className="space-y-3" aria-label="Reproductor de anime">
    <h4 className="font-semibold">Episodio {episode}</h4>
    {!options ? <Feedback {...response} /> : !selected ? <p role="status">La fuente no ofrece un reproductor para este episodio.</p> : <>
      <iframe className="aspect-video w-full rounded-lg bg-black" title={serie.title + ' · Episodio ' + episode} key={selected.url + reload}
        src={selected.url} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" />
      <div className="flex flex-wrap items-center gap-3">{options.length > 1 && <label className={field}>Servidor
        <select aria-label="Servidor" className={control} value={choice} onChange={e => setChoice(Number(e.target.value))}>
          {options.map((p,i) => <option key={p.url} value={i}>{i + 1} · {p.label}</option>)}
        </select></label>}
        <button className={action} onClick={() => setReload(r => r + 1)}>Recargar reproductor</button>
      </div></>}
  </section>;
}

function JKSeries({ work, source }: { work: Work; source: Source }) {
  const [number, setNumber] = useState('1'), [episode, setEpisode] = useState<number>();
  return <><form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setEpisode(Number(number)); }}>
    <label className={field}>Número de episodio<input className={control + ' w-28'} type="number" required min="1" max="99999" value={number}
      onChange={e => setNumber(e.target.value)} /></label><button className={action}>Ver episodio aquí</button></form>
    {episode !== undefined && <EpisodePlayer key={episode} source={source} serie={work} episode={episode} />}</>;
}

function Chapters({ id }: { id: string }) {
  const [lang, setLang] = useState('es'), [page, setPage] = useState(0);
  const [chapter, setChapter] = useState<Link>();
  const response = useResource<Page<Link>>(api + 'manga/' + id + '/capitulos?lang=' + lang + '&page=' + page);
  if (chapter) return <><button className={action} onClick={() => setChapter(undefined)}>← Volver a capítulos</button><OnlineReader chapter={chapter} /></>;
  return <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2">
    <h4 className="font-serif text-2xl font-bold">Capítulos</h4>
    <select aria-label="Idioma de capítulos" className={control} value={lang} onChange={e => { setLang(e.target.value); setPage(0); }}>
      <option value="es">Español y latino</option><option value="en">Inglés</option></select></div>
    {!response.data ? <Feedback {...response} /> : <>
      {response.data.items.length === 0 && <p className="text-sm text-zinc-300">No hay capítulos disponibles en este idioma en esta página.</p>}
      <ul className="max-h-72 divide-y divide-zinc-700 overflow-auto">{response.data.items.map(c => <li key={c.url + c.label}>
        {c.chapterId ? <button className="py-2 text-left hover:text-red-300" onClick={() => setChapter(c)}>{c.label}</button> :
          <a className="block py-2 hover:text-red-300" target="_blank" rel="noreferrer" href={c.url}>{c.label} ↗</a>}
        {!!c.groups?.length && <div className="pb-2 text-xs text-zinc-400">{c.groups.map((g,i) =>
          <React.Fragment key={g.url}>{i > 0 && ' · '}<a className="underline" target="_blank" rel="noreferrer" href={g.url}>{g.name}</a></React.Fragment>)}</div>}
      </li>)}</ul>
      <Pager page={page} next={response.data.next} onPage={setPage} />
    </>}
  </section>;
}

function SourceReleases({ work, source }: { work: Work; source: Source }) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Link>();
  const params = new URLSearchParams({ page: String(page) });
  const manga = source.id === 'inmanga';
  if (manga) params.set('serie', decodeURIComponent(new URL(work.original).pathname.split('/')[3]));
  const list = useResource<Page<Link>>(api + 'fuente/' + source.id + '/' + encodeURIComponent(work.id) + '/entregas?' + params);
  if (open) return <div className="space-y-3">
    <button className={action} onClick={() => setOpen(undefined)}>← Volver a {manga ? 'capítulos' : 'episodios'}</button>
    {manga ? <OnlineReader chapter={open} source="inmanga" /> : <EpisodePlayer source={source} serie={work} episode={open.episode!} />}
  </div>;
  return <section className="space-y-2">
    <h4 className="font-serif text-2xl font-bold">{manga ? 'Capítulos' : 'Episodios'}</h4>
    {!list.data ? <Feedback {...list} /> : <>
      {!list.data.items.length && <p className="text-sm text-zinc-400">La fuente todavía no lista {manga ? 'capítulos' : 'episodios'}.</p>}
      <ul className="grid max-h-64 grid-cols-2 gap-1 overflow-auto sm:grid-cols-3">{list.data.items.map(l => <li key={l.url}>
        <button className="block py-2 text-left text-sm hover:text-red-300" onClick={() => setOpen(l)}>{l.label}</button>
      </li>)}</ul>
      <Pager page={page} next={list.data.next} onPage={setPage} />
    </>}
  </section>;
}

function Details({ source, work, close, findEdition }: {
  source: Source; work: Work; close: () => void; findEdition: (source: string, title: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={dialog} onCancel={close} aria-labelledby="online-work-title"
    className="max-h-[90dvh] w-[min(94vw,44rem)] space-y-4 overflow-auto rounded-xl border border-white/20 bg-zinc-900 p-5 text-zinc-100 backdrop:bg-black/80">
    <div className="flex items-start justify-between gap-3"><h3 id="online-work-title" className="font-serif text-3xl font-bold">{work.title}</h3>
      <button className={action} onClick={close}>Cerrar</button></div>
    {(work.year || work.genres.length > 0 || work.info) && <p className="text-sm text-zinc-400">{[work.year, ...work.genres, work.info].filter(Boolean).join(' · ')}</p>}
    {source.id === 'kitsu' && <button className={action} onClick={() => findEdition('tioanime', work.searchTitle || work.title)}>Buscar episodios en NekoPress</button>}
    {source.id === 'olympus' && <button className={action} onClick={() => findEdition('inmanga', work.title)}>Buscar esta serie en el lector de NekoPress</button>}
    {source.id === 'jkanime' && <JKSeries source={source} work={work} />}
    {source.id === 'mangadex' && <Chapters id={work.id} />}
    {(source.id === 'tioanime' || source.id === 'inmanga') && <SourceReleases work={work} source={source} />}
    {source.id === 'kitsu' && <section className="space-y-2">
      <h4 className="font-semibold">Dónde ver</h4>{work.links.length ? <>
        <div className="flex flex-wrap gap-2">{work.links.map(l => <a className={action} key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}</div>
        <p className="text-xs text-zinc-400">La disponibilidad depende de tu país y de la plataforma.</p></> :
        <p className="text-sm text-zinc-400">Kitsu aún no indica una plataforma para esta serie.</p>}
    </section>}
    <a className="inline-block text-sm text-red-300 underline" href={work.original} target="_blank" rel="noreferrer">{source.id === 'mangadex' || source.id === 'kitsu' ? 'Ficha en' : 'Abrir en'} {source.name} ↗</a>
  </dialog>;
}

export function OnlineCatalog({ kind }: { kind: Kind }) {
  const [input, setInput] = useState(''), [q, setQ] = useState('');
  const available = sources[kind];
  const [sourceId, setSourceId] = useState(available[0].id);
  const source = available.find(s => s.id === sourceId) || available[0];
  const [genre, setGenre] = useState(''), [sort, setSort] = useState(source.sorts[0][0]), [page, setPage] = useState(0);
  // JKAnime serves title searches and its filterable directory from different pages.
  const directoryFilters = source.id !== 'jkanime' || !q;
  const [selected, setSelected] = useState<Work>();
  function changeSource(id: string, title: string) {
    const next = available.find(s => s.id === id);
    if (!next) return;
    setSourceId(id); setSort(next.sorts[0][0]); setGenre(''); setInput(title); setQ(title.trim()); setPage(0); setSelected(undefined);
  }
  const response = useResource<Page<Work>>(api + kind + '?' + new URLSearchParams({
    source: source.id, q, genre: directoryFilters && source.genres ? genre : '', sort: directoryFilters ? sort : '', page: String(page),
  }));
  return <section aria-labelledby="online-heading" className="space-y-4 border-t border-white/15 pt-6">
    <h2 id="online-heading" className="font-serif text-3xl font-bold">{kind === 'anime' ? 'Anime en línea' : 'Manga en línea'}</h2>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setQ(input.trim()); setPage(0); }}>
      <label className={field}>Fuente<select aria-label="Fuente" className={control} value={source.id} onChange={e => changeSource(e.target.value, input)}>{available.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className={field + ' min-w-40 flex-1'}>Buscar por título<input type="search" maxLength={100} className={control} value={input} onChange={e => setInput(e.target.value)} /></label>
      <button className={action}>Buscar</button>
      {directoryFilters && source.genres && <label className={field}>Género<select aria-label="Género" className={control} value={genre} onChange={e => { setGenre(e.target.value); setPage(0); }}>
        <option value="">Todos</option><option value="action">Acción</option><option value="adventure">Aventura</option>
        <option value="drama">Drama</option><option value="fantasy">Fantasía</option></select></label>}
      {directoryFilters && source.sorts.length > 1 && <label className={field}>Orden<select aria-label="Orden" className={control} value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}>
        {source.sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
    </form>
    {!response.data ? <><Feedback {...response} />{response.error &&
      <a className="text-sm text-red-300 underline" href={source.directory} target="_blank" rel="noreferrer">Abrir {source.name} ↗</a>}</> : <>
      {response.data.saved && <p role="status" className="text-sm text-zinc-400">La fuente no responde. Estás viendo una selección guardada.</p>}
      {!response.data.items.length && <p role="status">Sin títulos para esta búsqueda.</p>}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">{response.data.items.map(work => <li key={work.id}>
        <button aria-label={'Abrir ' + work.title} className="group block w-full space-y-2 text-left" onClick={() => setSelected(work)}>
          <PosterImage src={work.image} title={work.title} className="aspect-[2/3] w-full rounded-lg" imgClassName="aspect-[2/3] w-full rounded-lg object-cover group-hover:ring-2 group-hover:ring-red-400" />
          <span className="block font-serif text-lg font-semibold leading-tight">{work.title}</span>
          <span className="block text-xs text-zinc-400">{[work.year, ...work.genres.slice(0,2), work.info].filter(Boolean).join(' · ')}</span>
        </button></li>)}</ul>
      <Pager page={page} next={response.data.next} onPage={setPage} />
    </>}
    {kind === 'anime' && <a className="inline-block text-sm text-red-300 underline" href="https://www.animelatinohd.com/animes/latino" target="_blank" rel="noreferrer">Abrir el directorio de AnimeLatinoHD ↗</a>}
    {selected && <Details source={source} work={selected} findEdition={changeSource} close={() => setSelected(undefined)} />}
  </section>;
}
