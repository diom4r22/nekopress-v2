import React, { useEffect, useRef, useState } from 'react';
import { MangaReader } from './MangaReader.js';
import { PosterImage } from './PosterImage.js';

type Kind = 'anime' | 'manga';
type Link = { label: string; url: string; chapterId?: string };
type Work = { id: string; title: string; image: string; genres: string[]; year?: number; original: string; links: Link[] };
type Page<T> = { items: T[]; next: boolean; saved?: boolean };
const api = '/api/catalogo-online/';
const control = 'min-h-10 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-40';
const action = control + ' hover:border-red-400';
const field = 'grid gap-1 text-xs font-semibold text-zinc-300';

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

function OnlineReader({ chapter }: { chapter: Link }) {
  const key = 'nekopress.mangadex.' + chapter.chapterId;
  const manifest = useResource<{ pages: string[] }>(api + 'capitulo/' + chapter.chapterId + '/paginas');
  return <section className="space-y-3"><h4 className="font-semibold">{chapter.label}</h4>
    <a className="text-sm text-red-300 underline" target="_blank" rel="noreferrer" href={chapter.url}>Abrir en MangaDex ↗</a>
    {!manifest.data ? <Feedback {...manifest} /> : <MangaReader pages={manifest.data.pages} storageKey={key} />}
  </section>;
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
          <a className="block py-2 hover:text-red-300" target="_blank" rel="noreferrer" href={c.url}>{c.label} ↗</a>}</li>)}</ul>
      <Pager page={page} next={response.data.next} onPage={setPage} />
    </>}
  </section>;
}

function Details({ kind, work, close }: { kind: Kind; work: Work; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={dialog} onCancel={close} aria-labelledby="online-work-title"
    className="max-h-[90dvh] w-[min(94vw,44rem)] space-y-4 overflow-auto rounded-xl border border-white/20 bg-zinc-900 p-5 text-zinc-100 backdrop:bg-black/80">
    <div className="flex items-start justify-between gap-3"><h3 id="online-work-title" className="font-serif text-3xl font-bold">{work.title}</h3>
      <button className={action} onClick={close}>Cerrar</button></div>
    <p className="text-sm text-zinc-400">{[work.year, ...work.genres].filter(Boolean).join(' · ')}</p>
    {kind === 'manga' ? <Chapters id={work.id} /> : <section className="space-y-2">
      <h4 className="font-semibold">Dónde ver</h4>{work.links.length ? <>
        <div className="flex flex-wrap gap-2">{work.links.map(l => <a className={action} key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}</div>
        <p className="text-xs text-zinc-400">La disponibilidad depende de tu país y de la plataforma.</p></> :
        <p className="text-sm text-zinc-400">Kitsu aún no indica una plataforma para esta serie.</p>}
    </section>}
    <a className="inline-block text-sm text-red-300 underline" href={work.original} target="_blank" rel="noreferrer">Ficha en {kind === 'manga' ? 'MangaDex' : 'Kitsu'} ↗</a>
  </dialog>;
}

export function OnlineCatalog({ kind }: { kind: Kind }) {
  const [input, setInput] = useState(''), [q, setQ] = useState('');
  const [genre, setGenre] = useState(''), [sort, setSort] = useState('popular'), [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Work>();
  const response = useResource<Page<Work>>(api + kind + '?' + new URLSearchParams({ q,genre,sort,page:String(page) }));
  return <section aria-labelledby="online-heading" className="space-y-4 border-t border-white/15 pt-6">
    <h2 id="online-heading" className="font-serif text-3xl font-bold">{kind === 'anime' ? 'Anime en línea' : 'Manga en línea'}</h2>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setQ(input.trim()); setPage(0); }}>
      <label className={field + ' min-w-40 flex-1'}>Buscar por título<input type="search" maxLength={100} className={control} value={input} onChange={e => setInput(e.target.value)} /></label>
      <button className={action}>Buscar</button>
      <label className={field}>Género<select className={control} value={genre} onChange={e => { setGenre(e.target.value); setPage(0); }}>
        <option value="">Todos</option><option value="action">Acción</option><option value="adventure">Aventura</option>
        <option value="drama">Drama</option><option value="fantasy">Fantasía</option></select></label>
      <label className={field}>Orden<select className={control} value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}>
        <option value="popular">Popularidad</option><option value="rating">Valoración</option></select></label>
    </form>
    {!response.data ? <Feedback {...response} /> : <>
      {response.data.saved && <p role="status" className="text-sm text-zinc-400">La fuente no responde. Estás viendo una selección guardada.</p>}
      {!response.data.items.length && <p role="status">Sin títulos para esta búsqueda.</p>}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">{response.data.items.map(work => <li key={work.id}>
        <button aria-label={'Abrir ' + work.title} className="group block w-full space-y-2 text-left" onClick={() => setSelected(work)}>
          <PosterImage src={work.image} title={work.title} className="aspect-[2/3] w-full rounded-lg" imgClassName="aspect-[2/3] w-full rounded-lg object-cover group-hover:ring-2 group-hover:ring-red-400" />
          <span className="block font-serif text-lg font-semibold leading-tight">{work.title}</span>
          <span className="block text-xs text-zinc-400">{[work.year, ...work.genres.slice(0,2)].filter(Boolean).join(' · ')}</span>
        </button></li>)}</ul>
      <Pager page={page} next={response.data.next} onPage={setPage} />
    </>}
    {selected && <Details kind={kind} work={selected} close={() => setSelected(undefined)} />}
  </section>;
}
