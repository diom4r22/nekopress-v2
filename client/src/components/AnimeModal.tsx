import { headline } from '../lib/story.js';
import React, { useEffect, useState } from 'react';
import { X, Star, Film, Tv, Calendar, Building2, Tag, ExternalLink, Newspaper, ArrowRight } from 'lucide-react';
import { AnimeItem, NewsItem } from '../types.js';
import { BookmarkButton } from './BookmarkButton.js';
import { PosterImage } from './PosterImage.js';

interface AnimeModalProps {
  anime: AnimeItem | null;
  onClose: () => void;
  onSelectNews?: (news: NewsItem) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (anime: AnimeItem) => void;
}

export const AnimeModal: React.FC<AnimeModalProps> = ({
  anime,
  onClose,
  onSelectNews,
  isBookmarked = false,
  onToggleBookmark,
}) => {
  const [relatedNews, setRelatedNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch full details and related radar news
  useEffect(() => {
    if (!anime) return;
    fetch(`/api/anime/${anime.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && Array.isArray(json.relatedNews)) {
          setRelatedNews(json.relatedNews);
        }
      })
      .catch(() => {});
  }, [anime]);

  if (!anime) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[92vh] flex flex-col"
      >
        {/* Top Control Bar */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-zinc-900 dark:bg-white text-white dark:text-zinc-900">
              FICHA DE PRODUCCIÓN
            </span>
            <span className="text-xs text-zinc-500 font-medium font-mono">
              MAL ID #{anime.id}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onToggleBookmark && (
              <BookmarkButton
                active={isBookmarked}
                onClick={() => onToggleBookmark(anime)}
              />
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8">
            {/* Poster column */}
            <div className="md:col-span-4 shrink-0">
              <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shadow-md">
                <PosterImage
                  src={anime.imageUrl}
                  title={anime.title}
                  subtitle={anime.studios[0]}
                  loading="eager"
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900/90 text-amber-400 font-mono text-xs font-bold backdrop-blur">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{anime.score}</span>
                </div>
              </div>

              {/* Quick Specs */}
              <div className="mt-4 space-y-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Formato:</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{anime.format}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Episodios:</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{anime.episodes || 'TBA'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Estado:</span>
                  <span className={`font-semibold ${anime.airing ? 'text-emerald-600' : 'text-zinc-900 dark:text-white'}`}>
                    {anime.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Año / Temporada:</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{anime.season || anime.year || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Content Details Column */}
            <div className="md:col-span-8 space-y-5">
              <div>
                <h2 className="font-serif font-black text-2xl sm:text-3xl text-zinc-900 dark:text-white leading-tight">
                  {anime.title}
                </h2>
                {anime.titleJapanese && (
                  <p className="font-jp text-sm text-zinc-400 mt-1">
                    {anime.titleJapanese}
                  </p>
                )}
              </div>

              {/* Studios & Genres Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {anime.studios.map((studio) => (
                  <span
                    key={studio}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-600/10 text-red-600 dark:text-red-400 border border-red-600/20"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    {studio}
                  </span>
                ))}

                {anime.genres.map((genre) => (
                  <span
                    key={genre}
                    className="px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                  >
                    {genre}
                  </span>
                ))}
              </div>

              {/* Synopsis */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
                  Sinopsis Oficial
                </h4>
                <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans">
                  {anime.synopsis}
                </p>
              </div>

              {/* External MAL Link */}
              <div className="pt-2">
                <a
                  href={`https://myanimelist.net/anime/${anime.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-red-600 transition-colors"
                >
                  <span>Ver registro canónico en MyAnimeList</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Related News Wire Section (Live Radar Ingestion Link) */}
          {relatedNews.length > 0 && (
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-red-600" />
                <h4 className="font-serif font-bold text-lg text-zinc-900 dark:text-white">
                  Noticias de esta obra
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedNews.map((news) => (
                  <div
                    key={news.id}
                    onClick={() => {
                      if (onSelectNews) {
                        onClose();
                        onSelectNews(news);
                      }
                    }}
                    className="cursor-pointer p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/50 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono text-zinc-400 mb-0.5">
                        {news.sourceName}
                      </div>
                      <h5 className="font-serif font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-200 group-hover:text-red-600 transition-colors truncate">
                        {headline(news.title)}
                      </h5>
                    </div>
                    <ArrowRight className="w-4 h-4 shrink-0 text-zinc-400 group-hover:translate-x-0.5 group-hover:text-red-600 transition-transform" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
