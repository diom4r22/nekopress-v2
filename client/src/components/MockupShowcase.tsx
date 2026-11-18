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
import { headline, storyText, videoId } from '../lib/story.js';
import { PosterImage } from './PosterImage.js';

import { HomeSearch } from './HomeSearch.js';

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
      <div aria-hidden="true" className={`${className} grid place-items-center bg-gradient-to-br from-[#391a20] via-[#201820] to-[#111016]`}>
        <img src="/neko.svg" alt="" className="h-1/3 max-h-28 opacity-20 grayscale" />
      </div>
    );
  }

  return (
    <img
      src={item.imageUrl}
      alt={headline(item.title)}
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
  discoveryLoading: boolean;
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
  discoveryLoading,
}) => {
  const [clock, setClock] = useState(Date.now);
  const pin = filteredNews.find(n => n.featured && n.featured.until > Math.max(clock, Date.now()));
  useEffect(() => {
    if (!pin?.featured) return;
    const timer = setTimeout(() => setClock(Date.now()), Math.min(2_147_483_647, Math.max(1, pin.featured.until - Date.now())));
    return () => clearTimeout(timer);
  }, [pin, clock]);
  // Priorizar notas con imagen verificada para la cabecera y tendencias
  const orderedNews = React.useMemo(() => {
    const rest = filteredNews.filter(n => n !== pin).sort((a,b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    const withImg = rest.filter((n) => Boolean(n.imageUrl));
    const withoutImg = rest.filter((n) => !n.imageUrl);
    return [...(pin ? [pin] : []), ...withImg, ...withoutImg];
  }, [filteredNews, pin]);

  const searching = !!searchQuery.trim();
  const hero = orderedNews[0];
  const heroIntro = pin?.featured?.intro || (hero && storyText(hero).intro);
  const videos = filteredNews.filter(item => videoId(item.url)).slice(0, 4);
  const heroDock = orderedNews.slice(1, 5);
  const topFive = orderedNews.slice(5, 10);
  const mainStartIndex = Math.min(10, orderedNews.length);
  const mainFeed = orderedNews.slice(mainStartIndex, mainStartIndex + visibleCount);
  const todayShows = scheduleItems.filter((s) => s.day.toLowerCase() === todayDay.toLowerCase()).slice(0, 6);
  const radarFeed = allNews.filter((n) => n.isRadarFlash).slice(0, 6);
  const topRanking = [...catalog].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div className="w-full pb-16 space-y-10">
      {/* 1. Full-Bleed Cinematic Hero Stage */}
      <section className={`relative w-full bg-[#09090c] overflow-hidden flex flex-col ${searching ? '' : 'min-h-[500px] lg:min-h-[540px] justify-between'}`}>
        {!searching && hero && (
          <div className="absolute inset-0">
            <VisualThumb item={pin?.featured?.image ? { ...hero, imageUrl: pin.featured.image } : hero} className="w-full h-full" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#09090c] via-[#09090c]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/50" />
          </div>
        )}

        {/* Integrated Translucent Category & Search Bar */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-4 px-6 lg:px-10 py-4 bg-gradient-to-b from-black/85 via-black/45 to-transparent">
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 shrink-0">
              <span aria-label="NekoPress" className="font-serif text-3xl font-bold tracking-tighter text-white">Neko<span className="italic text-red-400">Press</span></span>
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
                { k: 'rss', l: 'Medios' },
                { k: 'radar', l: 'Redes' },
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
                type="search"
                aria-label="Buscar en NekoPress"
                placeholder="Buscar en NekoPress"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full bg-black/55 backdrop-blur-md border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-red-600"
              />
            </div>
          </div>
        </div>

        {/* Hero Story + Crisp Dark Dock ("EN PORTADA AHORA") */}
        {searching ? <HomeSearch query={searchQuery.trim()} news={filteredNews} catalog={catalog} schedule={scheduleItems}
          onArticle={onSelectNews} onAnime={onSelectAnime} onAnimeId={onSelectAnimeById}
          onCalendar={() => onSectionChange('schedule')} loading={discoveryLoading} /> : hero ? (
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
                {headline(hero.title)}
              </h1>

              {heroIntro && (
                <p className="text-sm sm:text-base text-zinc-200 max-w-2xl line-clamp-2 leading-relaxed">
                  {heroIntro}
                </p>
              )}

              <div className="pt-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onSelectNews(hero)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider -skew-x-12 cursor-pointer transition-transform active:scale-95 shadow-lg"
                >
                  <Play className="w-3.5 h-3.5 fill-white skew-x-12" />
                  <span className="skew-x-12">{videoId(hero.url) ? 'Ver video' : 'Leer noticia'}</span>
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
                      {headline(item.title)}
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

      {!searching && <>
      {/* 2. Top 01-05 Tendencias Row (High-contrast numbers & badges) */}
      {topFive.length > 0 && (
        <section className="px-6 lg:px-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-sans font-black text-lg uppercase tracking-wider flex items-center gap-2 text-zinc-900 dark:text-white">
              <span className="w-1.5 h-5 bg-red-600 inline-block -skew-x-12" />
              <span>En foco</span>
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
                    {headline(item.title)}
                  </h3>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {videos.length > 0 && <section aria-label="Sala de video" className="mx-6 rounded-xl bg-[#1c1419] p-5 text-white lg:mx-10">
        <h2 className="mb-4 border-l-4 border-red-500 pl-3 font-serif text-3xl font-bold">Sala de video</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{videos.map(video =>
          <button key={video.id} className="group text-left" onClick={() => onSelectNews(video)}>
            <div className="relative aspect-video overflow-hidden rounded-lg"><VisualThumb item={video}/>
              <Play aria-hidden="true" className="absolute bottom-3 left-3 rounded-full bg-red-600 p-2" size={36}/></div>
            <span className="mt-2 block text-xs text-zinc-300">{video.sourceName}</span>
            <strong>{headline(video.title)}</strong>
          </button>)}</div>
      </section>}

      {/* 3. Asymmetric Editorial Grid + Right Simulcast, Radar & Top Ranking */}
      <section className="px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-5">
          <h2 className="font-sans font-black text-lg uppercase tracking-wider flex items-center gap-2 text-zinc-900 dark:text-white">
            <span className="w-1.5 h-5 bg-red-600 inline-block -skew-x-12" />
            <span>Últimas noticias</span>
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
                      {headline(item.title)}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-200">{storyText(item).intro}</p>
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
              Ver más noticias ({orderedNews.length - (mainStartIndex + visibleCount)} restantes)
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
                  <Zap className="w-3.5 h-3.5" /> Desde las redes
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
                      {headline(item.title)}
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
      </>}
    </div>
  );
};
