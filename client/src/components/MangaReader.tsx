import React, { useState } from 'react';

const button = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-40';

export function readPosition(key: string) {
  try { const n = Number(localStorage.getItem(key)); return Number.isFinite(n) && n >= 0 ? n : 0; } catch { return 0; }
}
export function savePosition(key: string, n: number) {
  try { localStorage.setItem(key, String(n)); } catch { /* Private browsing can disable storage. */ }
}

export function MangaReader({ pages, storageKey }: { pages: string[]; storageKey: string }) {
  const [index, setIndex] = useState(() => Math.min(Math.floor(readPosition(storageKey)), pages.length - 1));
  const [attempt, setAttempt] = useState(0);
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
    {failed ? <p role="alert">No se pudo abrir esta página. <button className="underline" onClick={() => { setAttempt(a => a + 1); setFailed(false); }}>Reintentar</button></p> :
      <img key={attempt} className="mx-auto max-h-[82vh] max-w-full object-contain" src={pages[index]} alt={'Página ' + (index + 1)} onError={() => setFailed(true)} />}
  </div>;
}
