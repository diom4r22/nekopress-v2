import React, { useState } from 'react';
import type { NewsSource } from '../types.js';

import { videoId } from '../lib/story.js';

interface Article {
  url: string; animeOverrideId?: number;
  id: string; slug: string; title: string; summary: string; sourceName: string;
  category: string; overrideCategory: string | null; hidden: boolean;
}
interface Dashboard {
  feature: { id: string; until: number; intro: string; image: string } | null;
  categories: string[];
  catalog: Array<{ id: number; title: string; year?: number }>;
  sources: Array<NewsSource & { lastError?: string }>;
  articles: Article[];
}

export function EditorialPanel() {
  const [token, setToken] = useState('');
  const [data, setData] = useState<Dashboard | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Article | null>(null);
  const [category, setCategory] = useState('');
  const [hidden, setHidden] = useState(false);
  const [animeLink, setAnimeLink] = useState('');
  const [pin, setPin] = useState(false);
  const [until, setUntil] = useState('');
  const [intro, setIntro] = useState('');
  const [image, setImage] = useState('');
  const [limit, setLimit] = useState(25);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function request(path: string, options: RequestInit = {}) {
    const response = await fetch(path, { ...options, cache: 'no-store', headers: {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
    } });
    if (response.status === 403) throw new Error('Acceso denegado. Comprueba la clave de administración.');
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'La petición falló.');
    return response.json();
  }

  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Error de conexión.'); }
    finally { setBusy(false); }
  }

  function select(article: Article) {
    const feature = data?.feature?.id === article.id ? data.feature : null;
    const end = new Date(feature?.until ?? Date.now() + 86400000);
    setUntil(new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0,16));
    setAnimeLink(article.animeOverrideId?.toString() ?? '');
    setPin(!!feature); setIntro(feature?.intro ?? ''); setImage(feature?.image ?? '');
    setSelected(article); setCategory(article.overrideCategory ?? ''); setHidden(article.hidden); setMessage('');
  }

  const input = 'w-full rounded border border-zinc-600 bg-zinc-900 p-2';
  const button = 'rounded bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-600 disabled:opacity-50';
  const matches = data?.articles.filter(a => (a.title + ' ' + a.sourceName).toLowerCase().includes(search.toLowerCase())) ?? [];
  return <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><a href="/" className="text-sm text-zinc-300">NekoPress · Volver a portada</a><h1 className="mt-2 text-3xl font-bold">Panel editorial</h1></div>
        {data && <button disabled={busy} onClick={() => { setData(null); setToken(''); setSelected(null); setMessage(''); }}>Cerrar sesión</button>}
      </header>
      {message && <p role="status" className="rounded bg-zinc-800 p-3">{message}</p>}
      {!data ? <form className="max-w-sm space-y-4" onSubmit={event => {
        event.preventDefault(); void run(async () => setData(await request('/api/admin/editorial')));
      }}>
        <label className="block">Clave de administración<input required type="password" className={input} value={token}
          onChange={e => setToken(e.target.value)} autoComplete="current-password" /></label>
        <button className={button} disabled={busy}>Entrar</button>
      </form> : <>
        <section aria-labelledby="sources"><div className="flex items-center justify-between">
          <h2 id="sources" className="text-xl font-bold">Estado de las fuentes</h2>
          <button disabled={busy} onClick={() => void run(async () => setData(await request('/api/admin/editorial')))}>Actualizar</button>
        </div><ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.sources.map(source => <li key={source.id} className="rounded border border-zinc-800 p-3">
            <strong>{source.name}</strong>
            <div className="text-sm text-zinc-300">{source.status === 'error' ? 'Error de lectura' : !source.lastFetchedAt ? 'Pendiente' :
              Date.now() - Date.parse(source.lastFetchedAt) > 15 * 60000 ? 'Sin actualización reciente' : 'Al día'}
              {' · '}{source.itemCount} noticias</div>
            {source.lastFetchedAt && <small>Último intento: {new Date(source.lastFetchedAt).toLocaleString()}</small>}
            {source.status === 'error' && source.lastSuccessAt && <small className="block">Última lectura correcta: {new Date(source.lastSuccessAt).toLocaleString()}</small>}
            {source.lastError && <p className="break-words text-sm text-red-300">{source.lastError}</p>}
          </li>)}
        </ul></section>
        <section className="space-y-3"><h2 className="text-xl font-bold">Noticias</h2>
          <label className="block">Buscar por titular o fuente<input className={input} value={search} onChange={e => { setSearch(e.target.value); setLimit(25); }} /></label>
          {selected && <form className="space-y-3 rounded border border-red-900 p-4" onSubmit={e => {
            e.preventDefault(); void run(async () => {
              await request('/api/admin/editorial/' + encodeURIComponent(selected.id), { method: 'PUT', body: JSON.stringify({ category: category || null, hidden, animeOverrideId: videoId(selected.url) ? (animeLink === '' ? null : Number(animeLink)) : undefined, feature: pin && !hidden ? { until: new Date(until).getTime(), intro: intro.trim(), image: image.trim() } : null }) });
              setData(await request('/api/admin/editorial')); setSelected(null); setMessage('Cambios guardados.');
            });
          }}><h3 className="text-lg font-semibold">{selected.title}</h3><p>{selected.summary}</p>
            <a className="underline" href={'/noticias/' + encodeURIComponent(selected.slug)} target="_blank" rel="noreferrer">Abrir noticia completa</a>
            <label className="block" htmlFor="editorial-category">Categoría</label><select id="editorial-category" className={input} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">Automática</option>{data.categories.map(c => <option key={c}>{c}</option>)}</select>
            {videoId(selected.url) && <label className="block">Ficha del video
              <select className={input} value={animeLink} onChange={e => setAnimeLink(e.target.value)}>
                <option value="">Detectar por título</option><option value="0">Sin ficha</option>
                {!!selected.animeOverrideId && !data.catalog.some(a => a.id === selected.animeOverrideId) &&
                  <option value={selected.animeOverrideId}>Ficha {selected.animeOverrideId} (fuera del catálogo actual)</option>}
                {data.catalog.map(a => <option key={a.id} value={a.id}>{a.title}{a.year ? ' · ' + a.year : ''}</option>)}
              </select></label>}
            <label className="block"><input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} /> Retirar de portada</label>
            {!hidden && <fieldset className="space-y-2"><label><input type="checkbox" checked={pin} onChange={e => setPin(e.target.checked)} /> Destacar en portada</label>
              {pin && <><label className="block">Destacar hasta (hora local)<input required type="datetime-local" className={input} value={until} onChange={e => setUntil(e.target.value)} /></label>
                <label className="block">Bajada de portada (opcional)<textarea maxLength={300} className={input} value={intro} onChange={e => setIntro(e.target.value)} /></label>
                <label className="block">URL de imagen de un proveedor admitido (opcional)<input type="url" className={input} value={image} onChange={e => setImage(e.target.value)} /></label></>}
            </fieldset>}
            <div className="flex gap-4"><button disabled={busy} className={button}>Guardar cambios</button><button type="button" disabled={busy} onClick={() => setSelected(null)}>Cancelar</button></div>
          </form>}
          {matches.length === 0 && <p>No hay noticias que coincidan.</p>}
          <ul className="divide-y divide-zinc-800">{matches.slice(0, limit).map(a => <li key={a.id}>
            <button className="w-full py-3 text-left" disabled={busy} onClick={() => select(a)}>
              <span className="block text-xs text-zinc-300">{a.sourceName} · {a.category} · {data.feature?.id === a.id ? 'Destacada' : a.hidden ? 'Retirada' : 'Visible'}</span>{a.title}
            </button></li>)}</ul>
          {matches.length > limit && <button onClick={() => setLimit(limit + 25)}>Mostrar más</button>}
        </section>
      </>}
    </div>
  </main>;
}
