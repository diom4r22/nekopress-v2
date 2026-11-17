import React, { useEffect } from 'react';
import { X, Bookmark, Newspaper, Film } from 'lucide-react';
import { AnimeItem, NewsItem } from '../types.js';
import { SavedItem } from '../lib/bookmarks.js';
import { PosterImage } from './PosterImage.js';

interface SavedModalProps {
  open: boolean;
  items: SavedItem[];
  onClose: () => void;
  onSelectNews: (item: NewsItem) => void;
  onSelectAnime: (item: AnimeItem) => void;
  onRemove: (item: SavedItem) => void;
}

export const SavedModal: React.FC<SavedModalProps> = ({
  open,
  items,
  onClose,
  onSelectNews,
  onSelectAnime,
  onRemove,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const news = items.filter((item) => item.kind === 'news');
  const anime = items.filter((item) => item.kind === 'anime');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[88vh] flex flex-col"
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-amber-500 fill-amber-500" />
            <h2 className="font-serif font-black text-lg text-zinc-900 dark:text-white">Mis Guardados</h2>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {items.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar Mis Guardados"
            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-6">
          {items.length === 0 && (
            <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              <p className="font-serif font-bold text-zinc-900 dark:text-white">Todavía no hay nada guardado</p>
              <p className="text-xs text-zinc-500 mt-1">
                Usa el marcador en un despacho o en una ficha del catálogo. Se conserva al refrescar.
              </p>
            </div>
          )}

          {news.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                <Newspaper className="w-3.5 h-3.5 text-red-600" />
                Despachos ({news.length})
              </h3>
              {news.map((entry) => (
                <div
                  key={`news-${entry.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                >
                  <button
                    type="button"
                    onClick={() => onSelectNews(entry.item as NewsItem)}
                    className="min-w-0 text-left cursor-pointer"
                  >
                    <p className="font-serif font-bold text-sm text-zinc-900 dark:text-white line-clamp-2 hover:text-red-600">
                      {(entry.item as NewsItem).title}
                    </p>
                    <p className="text-[11px] font-mono text-zinc-500 mt-1">
                      {(entry.item as NewsItem).sourceName}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(entry)}
                    className="shrink-0 text-[11px] font-semibold text-zinc-500 hover:text-red-600 cursor-pointer"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </section>
          )}

          {anime.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                <Film className="w-3.5 h-3.5 text-red-600" />
                Fichas de anime ({anime.length})
              </h3>
              {anime.map((entry) => {
                const show = entry.item as AnimeItem;
                return (
                  <div
                    key={`anime-${entry.id}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectAnime(show)}
                      className="min-w-0 flex items-center gap-3 text-left cursor-pointer"
                    >
                      <div className="w-10 h-14 rounded-md overflow-hidden shrink-0 bg-zinc-200 dark:bg-zinc-800">
                        <PosterImage
                          src={show.imageUrl}
                          title={show.title}
                          className="w-full h-full"
                          imgClassName="w-full h-full object-cover"
                        />
                      </div>
                      <span>
                        <p className="font-serif font-bold text-sm text-zinc-900 dark:text-white line-clamp-2 hover:text-red-600">
                          {show.title}
                        </p>
                        <p className="text-[11px] font-mono text-zinc-500 mt-1">
                          {show.studios?.join(', ') || 'Estudio'} · {show.score}
                        </p>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(entry)}
                      className="shrink-0 text-[11px] font-semibold text-zinc-500 hover:text-red-600 cursor-pointer"
                    >
                      Quitar
                    </button>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
