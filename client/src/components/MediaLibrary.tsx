import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Clapperboard, ArrowLeft } from 'lucide-react';

type Kind = 'manga' | 'anime';
type Series = { name: string; items: string[] };
type Catalog = Record<Kind, Series[]>;
const api = '/api/biblioteca';
const link = (kind: Kind, series = '', item = '') => '/biblioteca?' + new URLSearchParams({ tipo: kind, ...(series && { serie: series }), ...(item && { obra: item }) });
const resource = (...parts: string[]) => api + '/' + parts.map(encodeURIComponent).join('/');
const display = (name: string, kind: Kind) => kind === 'anime' ? name.replace(/\.(mp4|webm)$/i, '') : name;
const button = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-40';
const panel = 'space-y-4 rounded-xl border border-white/15 bg-zinc-900 p-5';
const progressKey = (parts: string[]) => 'nekopress.media.' + JSON.stringify(parts);

function readPosition(key: string) {
  try { const n = Number(localStorage.getItem(key)); return Number.isFinite(n) && n >= 0 ? n : 0; } catch { return 0; }
}
function savePosition(key: string, n: number) {
  try { localStorage.setItem(key, String(n)); } catch { /* Private browsing can disable storage. */ }
}

function Reader({ pages, storageKey }: { pages: string[]; storageKey: string }) {
  const [index, setIndex] = useState(() => Math.min(Math.floor(readPosition(storageKey)), pages.length - 1));
  const [failed, setFailed] = useState(false);
  function go(next: number) {
    setIndex(next); setFailed(false); savePosition(storageKey, next);
  }
  if (!pages.length) return <p>Este capítulo todavía no tiene páginas.</p>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button className={button} disabled={index <= 0} onClick={() => go(index - 1)}>Anterior</button>
      <label className="text-sm">Página <select aria-label="Página" className="rounded bg-zinc-800 p-1" value={index} onChange={e => go(Number(e.target.value))}>
        {pages.map((url, i) => <option key={url} value={i}>{i + 1}</option>)}</select> de {pages.length}</label>
      <button className={button} disabled={index >= pages.length - 1} onClick={() => go(index + 1)}>Siguiente</button>
    </div>
    {failed ? <p role="alert">No se pudo abrir esta página.</p> :
      <img className="mx-auto max-h-[82vh] max-w-full object-contain" src={pages[index]} alt={'Página ' + (index + 1)} onError={() => setFailed(true)} />}
  </div>;
}

function Player({ url, storageKey }: { url: string; storageKey: string }) {
  const [failed, setFailed] = useState(false);
  const lastSave = useRef(0);
  return <>
    <video className="aspect-video w-full rounded-xl bg-black" src={url} controls playsInline preload="metadata"
      onLoadedMetadata={e => {
        const video = e.currentTarget, saved = readPosition(storageKey);
        if (saved > 0 && saved < video.duration) video.currentTime = saved;
      }}
      onTimeUpdate={e => {
        if (Date.now() - lastSave.current < 4000 || e.currentTarget.paused) return;
        lastSave.current = Date.now(); savePosition(storageKey, e.currentTarget.currentTime);
      }}
      onPause={e => { if (!e.currentTarget.ended && e.currentTarget.readyState > 0) savePosition(storageKey, e.currentTarget.currentTime); }}
      onEnded={() => savePosition(storageKey, 0)} onError={() => setFailed(true)} />
    {failed && <p role="alert">El navegador no pudo reproducir este episodio. Comprueba el archivo y su códec.</p>}
  </>;
}

function LocalFiles({ kind }: { kind: Kind }) {
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const next = files.map(f => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach(url => URL.revokeObjectURL(url));
  }, [files]);
  const manga = kind === 'manga';
  // Only enable the viewer when the URLs correspond to the current selection.
  const key = progressKey(['local', kind, ...files.map(f => [f.name, f.size, f.lastModified].join('|'))]);
  return <details className={panel}>
    <summary className="cursor-pointer font-semibold">Abrir {manga ? 'páginas' : 'un episodio'} de este dispositivo</summary>
    <p className="mt-3 text-sm text-zinc-400">{manga ? 'Selecciona las imágenes de un capítulo. Se ordenan por nombre.' : 'Selecciona un video MP4 o WebM.'} Los archivos se abren en tu navegador.</p>
    <input type="file" multiple={manga} aria-label={manga ? 'Seleccionar páginas' : 'Seleccionar episodio'}
      accept={manga ? '.jpg,.jpeg,.png,.webp,.avif' : '.mp4,.webm'} className="block max-w-full text-sm"
      onChange={e => {
        const selected = Array.from(e.target.files || []);
        const valid = manga ? /\.(jpe?g|png|webp|avif)$/i : /\.(mp4|webm)$/i;
        setError(selected.some(f => !valid.test(f.name)) ? 'Hay archivos con un formato incompatible.' : '');
        setUrls([]); setFiles(selected.filter(f => valid.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })));
      }} />
    {error && <p role="alert">{error}</p>}
    {!!urls.length && (manga ? <Reader key={key} pages={urls} storageKey={key} /> : <Player key={key} url={urls[0]} storageKey={key} />)}
  </details>;
}

function Chapter({ series, item }: { series: string; item: string }) {
  const [pages, setPages] = useState<string[]>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(resource('paginas', series, item), { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error('No se pudieron cargar las páginas.');
      const data = await r.json();
      setPages(data.pages.map((page: string) => resource('manga', series, item, page)));
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [series, item]);
  if (!pages) return <p role="status">{error || 'Cargando páginas…'}</p>;
  return <Reader pages={pages} storageKey={progressKey(['manga', series, item])} />;
}

export function MediaLibrary() {
  const params = new URLSearchParams(location.search);
  const kind = params.get('tipo') === 'anime' ? 'anime' : 'manga';
  const series = params.get('serie') || '', item = params.get('obra') || '';
  const [catalog, setCatalog] = useState<Catalog>();
  const [status, setStatus] = useState<'loading' | 'locked' | 'off' | 'error'>('loading');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function load(signal?: AbortSignal) {
    try {
      const r = await fetch(api + '/catalogo', { cache: 'no-store', signal });
      if (r.ok) setCatalog(await r.json());
      else setStatus(r.status === 401 ? 'locked' : r.status === 503 ? 'off' : 'error');
    } catch { if (!signal?.aborted) setStatus('error'); }
  }
  useEffect(() => {
    const controller = new AbortController(); void load(controller.signal);
    return () => controller.abort();
  }, []);
  const selected = catalog?.[kind].find(s => s.name === series);
  const position = selected?.items.indexOf(item) ?? -1;
  return <main className="min-h-screen bg-[#101014] px-4 pb-12 text-zinc-100 sm:px-8">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center justify-between border-b border-white/15 py-5">
        <a href="/" className="flex items-center gap-2 font-serif text-xl font-bold"><img src="/neko.svg" alt="" width="30" height="30" />NekoPress</a>
        {catalog && <button className={button} onClick={async () => {
          try { const r = await fetch(api + '/sesion', { method: 'DELETE' }); if (!r.ok) throw Error(); setCatalog(undefined); setStatus('locked'); setMessage(''); }
          catch { setMessage('No se pudo cerrar la sesión.'); }
        }}>Cerrar sesión</button>}
      </header>
      <h1 className="font-serif text-4xl font-bold">Biblioteca</h1>
      <nav aria-label="Colecciones" className="flex gap-2">{(['manga', 'anime'] as const).map(tab => {
        const Icon = tab === 'manga' ? BookOpen : Clapperboard;
        return <a href={link(tab)} key={tab} aria-current={tab === kind ? 'page' : undefined}
          className={button + (tab === kind ? ' bg-red-700' : '')}><Icon size={17} className="mr-2" />{tab === 'manga' ? 'Leer manga' : 'Ver anime'}</a>;
      })}</nav>
      {message && <p role="alert">{message}</p>}
      {!catalog ? status === 'locked' ? <form className={panel} onSubmit={async e => {
        e.preventDefault(); setBusy(true); setMessage('');
        try {
          const r = await fetch(api + '/sesion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
          if (!r.ok) throw new Error(r.status === 401 ? 'Clave incorrecta.' : 'No se pudo abrir la biblioteca.');
          setPassword(''); await load();
        } catch (err) { setMessage(err instanceof Error ? err.message : 'Error de conexión.'); }
        finally { setBusy(false); }
      }}><label className="block font-semibold">Clave de la biblioteca<input required type="password" autoComplete="current-password" value={password}
        onChange={e => setPassword(e.target.value)} className="mt-2 block w-full max-w-sm rounded border border-zinc-600 bg-zinc-950 p-2" /></label>
        <button className={button} disabled={busy}>Entrar</button></form> :
        <p role="status">{status === 'loading' ? 'Cargando biblioteca…' : status === 'off' ? 'La colección compartida está desactivada.' : 'No se pudo cargar la colección. Actualiza la página para reintentar.'}</p> :
        <section className={panel}>
          {series && <a className="inline-flex items-center gap-2 text-sm text-red-300" href={item ? link(kind, series) : link(kind)}><ArrowLeft size={16}/>{item ? 'Volver a la serie' : 'Volver a la colección'}</a>}
          <h2 className="break-words font-serif text-2xl font-bold">{item ? display(item, kind) : series || (kind === 'anime' ? 'Series de anime' : 'Series de manga')}</h2>
          {series && !selected || item && position < 0 ? <p>Este contenido ya no está en la colección.</p> :
            selected && item ? <>
              <p className="text-sm text-zinc-400">{series}</p>
              {kind === 'manga' ? <Chapter series={series} item={item} /> : <Player storageKey={progressKey([kind, series, item])} url={resource(kind, series, item)} />}
              {selected.items[position + 1] && <a className={button} href={link(kind, series, selected.items[position + 1])}>{kind === 'manga' ? 'Siguiente capítulo' : 'Siguiente episodio'}</a>}
            </> : <ul className="divide-y divide-white/10">{(selected ? selected.items : catalog[kind].map(s => s.name)).map(name =>
              <li key={name}><a className="block break-words py-3 hover:text-red-300" href={selected ? link(kind, series, name) : link(kind, name)}>{selected ? display(name, kind) : name}</a></li>)}</ul>}
          {(!series && !catalog[kind].length || selected && !selected.items.length) && <p className="text-zinc-400">Todavía no hay {series ? (kind === 'anime' ? 'episodios' : 'capítulos') : 'series'} en esta colección.</p>}
        </section>}
      {!item && <LocalFiles key={kind} kind={kind} />}
    </div>
  </main>;
}
