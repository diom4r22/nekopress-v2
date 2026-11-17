import React, { useEffect, useState } from 'react';
import {
  Search,
  Zap,
  Play,
  Bookmark,
  Star,
} from 'lucide-react';
import { AnimeItem, DayOfWeek, NewsItem, ScheduleItem } from '../types.js';
import { formatTimeAgo } from './HeroCover.js';
import { PosterImage } from './PosterImage.js';

const VisualThumb: React.FC<{
  item: NewsItem;
  className?: string;
}> = ({ item, className = 'w-full h-full' }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [item.id, item.imageUrl]);

  if (!item.imageUrl || hasError) {
    return (
      <div className={`${className} relative overflow-hidden bg-gradient-to-br from-zinc-900 via-[#14141a] to-black flex flex-col justify-between p-4 select-none`}>
        <div className="absolute -right-6 -bottom-8 font-jp font-black text-7xl opacity-10 pointer-events-none text-red-600">
          速報
        </div>
        <span className="w-fit px-2 py-0.5 text-[10px] font-mono font-black uppercase tracking-wider text-white bg-red-600 -skew-x-12">
          {item.category}
        </span>
        <div className="z-10">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
            {item.sourceName}
          </p>
          <p className="font-serif font-bold text-sm text-zinc-100 line-clamp-2 mt-1">
            {item.title}
          </p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={item.imageUrl}
      alt={item.title}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`${className} object-cover transition-transform duration-500 group-hover:scale-105`}
    />
  );
};

export interface ShibuyaStreamLayoutProps {
  filteredNews: NewsItem[];
  allNews: NewsItem[];
  scheduleItems: ScheduleItem[];
  todayDay: DayOfWeek;
  catalog: AnimeItem[];
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  sourceFilter: 'all' | 'rss' | 'radar';
  onSourceFilterChange: (src: 'all' | 'rss' | 'radar') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  visibleCount: number;
  onLoadMore: () => void;
  onSelectNews: (item: NewsItem) => void;
  onSelectAnime: (anime: AnimeItem) => void;
  onSelectAnimeById: (id: number) => void;
  onSectionChange: (section: 'news' | 'catalog' | 'schedule' | 'ranking') => void;
  isBookmarked?: (kind: 'news', id: string) => boolean;
  onToggleBookmark?: (item: NewsItem) => void;
  isLoading?: boolean;
}

export const MockupNewsLayout: React.FC<ShibuyaStreamLayoutProps> = ({
  filteredNews,
  allNews,
  scheduleItems,
  todayDay,
  catalog,
  categories,
  selectedCategory,
  onCategoryChange,
  sourceFilter,
  onSourceFilterChange,
  searchQuery,
  onSearchChange,
  visibleCount,
  onLoadMore,
  onSelectNews,
  onSelectAnime,
  onSelectAnimeById,
  onSectionChange,
  isBookmarked,
  onToggleBookmark,
  isLoading = false,
}) => {
  // Priorizar notas con imagen verificada para la cabecera y tendencias
  const orderedNews = React.useMemo(() => {
    const withImg = filteredNews.filter((n) => Boolean(n.imageUrl));
    const withoutImg = filteredNews.filter((n) => !n.imageUrl);
    return [...withImg, ...withoutImg];
  }, [filteredNews]);

  const hero = orderedNews[0];
  const heroDock = orderedNews.slice(1, 5);
  const topFive = orderedNews.length >= 10 ? orderedNews.slice(5, 10) : orderedNews.slice(1, 6);
  const mainStartIndex = orderedNews.length >= 10 ? 10 : Math.min(6, orderedNews.length);
  const mainFeed = orderedNews.slice(mainStartIndex, mainStartIndex + visibleCount);
  const todayShows = scheduleItems.filter((s) => s.day.toLowerCase() === todayDay.toLowerCase()).slice(0, 6);
  const radarFeed = allNews.filter((n) => n.isRadarFlash).slice(0, 6);
  const topRanking = [...catalog].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div className="w-full pb-16 space-y-10">
      {/* 1. Full-Bleed Cinematic Hero Stage */}
      <section className="relative w-full min-h-[500px] lg:min-h-[540px] bg-[#09090c] overflow-hidden flex flex-col justify-between">
        {hero && (
          <div className="absolute inset-0">
            <VisualThumb item={hero} className="w-full h-full" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#09090c] via-[#09090c]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/50" />
          </div>
        )}

        {/* Integrated Translucent Category & Search Bar */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-4 px-6 lg:px-10 py-4 bg-gradient-to-b from-black/85 via-black/45 to-transparent">
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-serif font-black text-xl tracking-tight text-white">NEKOPRESS</span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-black -skew-x-12 bg-red-600 text-white">
                LIVE
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              {categories.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onCategoryChange(cat)}
                    className={`whitespace-nowrap pb-1 transition-all cursor-pointer border-b-2 ${
                      active
                        ? 'text-white border-red-600 font-bold'
                        : 'text-white/70 border-transparent hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1 bg-black/55 backdrop-blur-md rounded-full p-0.5 border border-white/15 text-[11px] font-mono">
              {[
                { k: 'all', l: 'Todo' },
                { k: 'rss', l: 'Agencias' },
                { k: 'radar', l: 'Radar' },
              ].map((src) => (
                <button
                  key={src.k}
                  type="button"
                  onClick={() => onSourceFilterChange(src.k as any)}
                  className={`px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                    sourceFilter === src.k ? 'bg-white text-black font-bold' : 'text-white/75 hover:text-white'
                  }`}
                >
                  {src.l}
                </button>
              ))}
            </div>

            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 text-white/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar noticia o anime..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full bg-black/55 backdrop-blur-md border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-red-600"
              />
            </div>
          </div>
        </div>

        {/* Hero Story + Crisp Dark Dock ("EN PORTADA AHORA") */}
        {hero ? (
          <div className="relative z-10 px-6 lg:px-10 pb-8 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-red-600 text-white font-mono font-black text-xs uppercase tracking-wider -skew-x-12 shadow-lg">
                  <span className="inline-block skew-x-12">{hero.category}</span>
                </span>
                <span className="text-xs font-mono text-zinc-200 drop-shadow-xs">
                  {hero.sourceName} · {formatTimeAgo(hero.publishedAt)}
                </span>
              </div>

              <h1
                onClick={() => onSelectNews(hero)}
                className="font-sans font-black text-3xl sm:text-4xl lg:text-5xl text-white leading-[1.08] tracking-tight cursor-pointer hover:text-red-400 transition-colors"
              >
                {hero.title}
              </h1>

              {hero.summary && (
                <p className="text-sm sm:text-base text-zinc-200 max-w-2xl line-clamp-2 leading-relaxed">
                  {hero.summary}
                </p>
              )}

              <div className="pt-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onSelectNews(hero)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider -skew-x-12 cursor-pointer transition-transform active:scale-95 shadow-lg"
                >
                  <Play className="w-3.5 h-3.5 fill-white skew-x-12" />
                  <span className="skew-x-12">Leer Crónica Completa</span>
                </button>

                {onToggleBookmark && isBookmarked && (
                  <button
                    type="button"
                    onClick={() => onToggleBookmark(hero)}
                    title={isBookmarked('news', hero.id) ? 'Quitar de guardados' : 'Guardar noticia'}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 border text-xs font-mono font-bold -skew-x-12 cursor-pointer transition-colors ${
                      isBookmarked('news', hero.id)
                        ? 'bg-amber-400 text-black border-amber-400'
                        : 'bg-black/60 text-white border-white/25 hover:border-white'
                    }`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 skew-x-12 ${isBookmarked('news', hero.id) ? 'fill-black' : ''}`} />
                    <span className="skew-x-12">{isBookmarked('news', hero.id) ? 'Guardado' : 'Guardar'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 hidden sm:block bg-[#0c0c10]/90 backdrop-blur-xl border border-white/15 rounded-xl p-4 space-y-2.5 shadow-2xl">
              <div className="text-[10px] font-mono font-black uppercase tracking-widest flex items-center justify-between pb-1 border-b border-white/10">
                <span className="px-2 py-0.5 bg-red-600 text-white -skew-x-12">
                  <span className="inline-block skew-x-12">EN PORTADA AHORA</span>
                </span>
                <span className="text-zinc-300">TOKIO LIVE</span>
              </div>
              {heroDock.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectNews(item)}
                  className="w-full flex items-center gap-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-left group cursor-pointer"
                >
                  <div className="w-20 h-12 rounded overflow-hidden shrink-0">
                    <VisualThumb item={item} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-mono text-zinc-400">
                      {item.sourceName} · {formatTimeAgo(item.publishedAt)}
                    </p>
                    <p className="text-xs font-bold text-zinc-100 group-hover:text-red-400 line-clamp-2 leading-snug">
                      {item.title}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : isLoading ? (
          <div className="relative z-10 px-6 lg:px-10 py-16 space-y-4 animate-pulse">
            <div className="h-5 w-36 bg-white/10 rounded" />
            <div className="h-12 w-2/3 bg-white/15 rounded-lg" />
            <div className="h-4 w-1/2 bg-white/10 rounded" />
          </div>
        ) : (
          <div className="relative z-10 px-6 lg:px-10 py-16 text-center text-zinc-400 font-mono text-sm">
            No se encontraron noticias para los filtros seleccionados.
          </div>
        )}
      </section>

      {/* 2. Top 01-05 Tendencias Row (High-contrast numbers & badges) */}
      {topFive.length > 0 && (
        <section className="px-6 lg:px-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-sans font-black text-lg uppercase tracking-wider flex items-center gap-2 text-zinc-900 dark:text-white">
              <span className="w-1.5 h-5 bg-red-600 inline-block -skew-x-12" />
              <span>Tendencias Globales · Top 5</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {topFive.map((item, idx) => (
              <article
                key={item.id}
                onClick={() => onSelectNews(item)}
                className="group relative aspect-[16/10] rounded-xl overflow-hidden bg-zinc-900 cursor-pointer ring-1 ring-black/10 dark:ring-white/10 hover:ring-red-600 transition-all"
              >
                <VisualThumb item={item} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
                <span className="absolute top-2 left-2 px-2.5 py-0.5 bg-black/80 backdrop-blur-md border-l-2 border-red-600 font-mono font-black italic text-base text-white group-hover:bg-red-600 transition-colors leading-none select-none">
                  0{idx + 1}
                </span>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <span className="inline-block px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-mono font-black uppercase -skew-x-12 mb-1">
                    {item.category}
                  </span>
                  <h3 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-red-400 transition-colors">
                    {item.title}
                  </h3>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 3. Asymmetric Editorial Grid + Right Simulcast, Radar & Top Ranking */}
      <section className="px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-5">
          <h2 className="font-sans font-black text-lg uppercase tracking-wider flex items-center gap-2 text-zinc-900 dark:text-white">
            <span className="w-1.5 h-5 bg-red-600 inline-block -skew-x-12" />
            <span>Últimos Despachos Verificados</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {mainFeed.map((item) => {
              const saved = isBookmarked ? isBookmarked('news', item.id) : false;
              return (
                <article
                  key={item.id}
                  onClick={() => onSelectNews(item)}
                  className="group relative aspect-[16/9] rounded-xl overflow-hidden bg-zinc-900 cursor-pointer ring-1 ring-black/10 dark:ring-white/10 hover:ring-red-600 transition-all"
                >
                  <VisualThumb item={item} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent" />
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-mono font-black uppercase -skew-x-12 shadow-sm">
                      {item.category}
                    </span>
                    {onToggleBookmark && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBookmark(item);
                        }}
                        aria-label={saved ? 'Quitar de guardados' : 'Guardar'}
                        className={`p-1.5 rounded-lg backdrop-blur-md transition-colors cursor-pointer ${
                          saved
                            ? 'bg-amber-400 text-black'
                            : 'bg-black/60 text-white/85 opacity-0 group-hover:opacity-100 hover:text-amber-300'
                        }`}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-black' : ''}`} />
                      </button>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-[10px] font-mono text-zinc-300">
                      {item.sourceName} · {formatTimeAgo(item.publishedAt)}
                    </p>
                    <h3 className="text-sm sm:text-base font-extrabold text-white group-hover:text-red-400 line-clamp-2 leading-snug mt-1 transition-colors">
                      {item.title}
                    </h3>
                  </div>
                </article>
              );
            })}
          </div>

          {orderedNews.length > mainStartIndex + visibleCount && (
            <button
              type="button"
              onClick={onLoadMore}
              className="w-full py-3 rounded-xl bg-zinc-200 dark:bg-[#121218] hover:bg-zinc-300 dark:hover:bg-white/10 border border-zinc-300 dark:border-white/10 text-xs font-mono font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors"
            >
              Cargar más despachos ({orderedNews.length - (mainStartIndex + visibleCount)} restantes)
            </button>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-6">
          {/* Emisiones Hoy en Tokio */}
          <div className="bg-white dark:bg-[#121218] border border-zinc-200 dark:border-white/10 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-mono font-black text-xs uppercase tracking-wider text-zinc-900 dark:text-white">
                Emisiones Hoy ({todayDay})
              </h3>
              <button
                type="button"
                onClick={() => onSectionChange('schedule')}
                className="text-[11px] font-mono text-red-500 hover:underline cursor-pointer"
              >
                Calendario &rarr;
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {todayShows.map((show) => (
                <div
                  key={show.id}
                  onClick={() => show.animeId && onSelectAnimeById(show.animeId)}
                  className="group cursor-pointer space-y-1"
                >
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden ring-1 ring-black/10 dark:ring-white/10">
                    <PosterImage src={show.imageUrl} title={show.title} />
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/85 text-[9px] font-mono text-white">
                      {show.timeJST}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 truncate group-hover:text-red-500">
                    {show.title}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Radar Bluesky En Vivo */}
          {radarFeed.length > 0 && (
            <div className="bg-white dark:bg-[#121218] border border-zinc-200 dark:border-white/10 rounded-xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-mono font-black text-xs uppercase tracking-wider text-red-500 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Radar en Tiempo Real
                </h3>
              </div>
              <div className="space-y-3 divide-y divide-zinc-200 dark:divide-white/5">
                {radarFeed.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectNews(item)}
                    className="w-full pt-2.5 first:pt-0 text-left group cursor-pointer"
                  >
                    <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                      {item.sourceName} · {formatTimeAgo(item.publishedAt)}
                    </p>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-red-400 line-clamp-2 mt-0.5">
                      {item.title.replace(/^⚡\s*RADAR X:\s*/i, '')}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Top 5 Ranking Compacto */}
          {topRanking.length > 0 && (
            <div className="bg-white dark:bg-[#121218] border border-zinc-200 dark:border-white/10 rounded-xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-mono font-black text-xs uppercase tracking-wider text-amber-500">
                  Top 5 Industria
                </h3>
                <button
                  type="button"
                  onClick={() => onSectionChange('ranking')}
                  className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 hover:text-red-500 cursor-pointer"
                >
                  Ranking &rarr;
                </button>
              </div>
              <div className="space-y-2">
                {topRanking.map((anime, idx) => (
                  <button
                    key={anime.id}
                    type="button"
                    onClick={() => onSelectAnime(anime)}
                    className="w-full flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-black text-xs text-red-500 w-4">0{idx + 1}</span>
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-red-400 truncate">
                        {anime.title}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-amber-500 shrink-0">
                      <Star className="w-3 h-3 fill-amber-500" /> {anime.score}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
};
