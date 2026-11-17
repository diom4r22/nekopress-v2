import React, { useState, useMemo } from 'react';
import { Trophy, Medal, Star, Flame, Film, Tv, ArrowUpRight, TrendingUp, Sparkles, Building2 } from 'lucide-react';
import { AnimeItem } from '../types.js';
import { PosterImage } from './PosterImage.js';

interface RankingViewProps {
  catalog: AnimeItem[];
  onSelectAnime: (anime: AnimeItem) => void;
}

type RankingCategory = 'all' | 'popular' | 'airing' | 'movies';

export const RankingView: React.FC<RankingViewProps> = ({ catalog, onSelectAnime }) => {
  const [category, setCategory] = useState<RankingCategory>('all');

  // Compute sorted list in memory (instant 0ms)
  const rankedList = useMemo(() => {
    let list = [...catalog];

    if (category === 'airing') {
      list = list.filter((a) => a.airing && a.status === 'En Emisión');
      list.sort((a, b) => b.score - a.score);
    } else if (category === 'movies') {
      list = list.filter((a) => a.format === 'Movie');
      list.sort((a, b) => b.score - a.score);
    } else if (category === 'popular') {
      list.sort((a, b) => {
        const popA = a.popularity ?? 9999;
        const popB = b.popularity ?? 9999;
        if (popA > 1000 || popB > 1000) return popB - popA;
        return popA - popB;
      });
    } else {
      // Top Crítica Histórica: strictly completed masterworks
      list = list.filter((a) => !a.airing && a.status === 'Finalizado');
      list.sort((a, b) => b.score - a.score);
    }

    return list.map((item, idx) => ({
      ...item,
      position: idx + 1,
    }));
  }, [catalog, category]);

  const podium = rankedList.slice(0, 3);
  const runnersUp = rankedList.slice(3);

  const avgScore = useMemo(() => {
    if (rankedList.length === 0) return '0.0';
    return (rankedList.reduce((acc, cur) => acc + cur.score, 0) / rankedList.length).toFixed(2);
  }, [rankedList]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-red-600 text-white flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              <span>TABLAS OFICIALES DE LA INDUSTRIA</span>
            </span>
            <span className="text-xs font-mono text-zinc-500">
              PROMEDIO CRÍTICO: ★ {avgScore}
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            Ranking & Podio Canónico
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Clasificación oficial basada en calificaciones críticas de la industria (MyAnimeList / AniList) y métricas de audiencia.
          </p>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setCategory('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              category === 'all'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-500" />
            <span>Top Crítica</span>
          </button>

          <button
            onClick={() => setCategory('popular')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              category === 'popular'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-red-500" />
            <span>Más Populares</span>
          </button>

          <button
            onClick={() => setCategory('airing')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              category === 'airing'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>En Emisión</span>
          </button>

          <button
            onClick={() => setCategory('movies')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              category === 'movies'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-blue-500" />
            <span>Películas</span>
          </button>
        </div>
      </div>

      {/* 2. Visual Podium (Top 3) */}
      {podium.length > 0 && (
        <section aria-label="Podio de Honor" className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
            <span className="flex items-center gap-1.5 text-zinc-900 dark:text-white font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>EL PODIO DE HONOR</span>
            </span>
            <span>TOP 3 SELECCIONADO</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-stretch">
            {podium.map((anime) => {
              const isFirst = anime.position === 1;
              const isSecond = anime.position === 2;
              const isThird = anime.position === 3;

              const medalColor = isFirst
                ? 'bg-amber-400 text-zinc-950 border-amber-300'
                : isSecond
                ? 'bg-slate-300 text-zinc-900 border-slate-200'
                : 'bg-amber-700 text-white border-amber-600';

              const ringBorder = isFirst
                ? 'border-amber-400/60 dark:border-amber-500/50 shadow-md ring-2 ring-amber-400/20'
                : 'border-zinc-200 dark:border-zinc-800';

              return (
                <div
                  key={anime.id}
                  onClick={() => onSelectAnime(anime)}
                  className={`group relative flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border ${ringBorder} overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-200 hover:-translate-y-1`}
                >
                  {/* Position Crown Header */}
                  <div className="p-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/50">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs border ${medalColor} shadow-2xs`}
                      >
                        #{anime.position}
                      </span>
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        {isFirst ? 'ORO CANÓNICO' : isSecond ? 'PLATA DE ÉLITE' : 'BRONCE DESTACADO'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-500">
                      <Star className="w-3.5 h-3.5 fill-amber-500" />
                      <span>{anime.score}</span>
                    </div>
                  </div>

                  {/* Poster Image Frame */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    <PosterImage
                      src={anime.imageUrl}
                      title={anime.title}
                      subtitle={anime.studios[0]}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex items-end p-4">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-950/80 text-white backdrop-blur">
                          {anime.studios.join(', ')}
                        </span>
                        <h3 className="font-serif font-black text-lg text-white leading-snug line-clamp-1">
                          {anime.title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {anime.synopsis}
                    </p>

                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-500">
                      <span>{anime.episodes ? `${anime.episodes} episodios` : 'En emisión'}</span>
                      <span className="text-red-600 dark:text-red-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        Ver expediente →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Detailed Leaderboard Table (Rows #4 onwards) */}
      {runnersUp.length > 0 && (
        <section aria-label="Tabla de Posiciones" className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500 px-1">
            <span>CLASIFICACIÓN GENERAL (POSICIONES 4 AL {rankedList.length})</span>
            <span>{runnersUp.length} PRODUCCIONES</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs divide-y divide-zinc-100 dark:divide-zinc-800">
            {runnersUp.map((anime) => (
              <div
                key={anime.id}
                onClick={() => onSelectAnime(anime)}
                className="group p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
              >
                {/* Left: Position & Poster & Title */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  {/* Position number */}
                  <div className="w-8 text-center shrink-0">
                    <span className="font-mono font-black text-sm text-zinc-400 group-hover:text-red-600 transition-colors">
                      #{anime.position}
                    </span>
                  </div>

                  {/* Thumbnail Poster */}
                  <div className="w-12 h-16 rounded-lg overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    <PosterImage
                      src={anime.imageUrl}
                      title={anime.title}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>

                  {/* Titles */}
                  <div className="min-w-0">
                    {anime.titleJapanese && (
                      <p className="font-jp text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-1">
                        {anime.titleJapanese}
                      </p>
                    )}
                    <h4 className="font-serif font-bold text-sm sm:text-base text-zinc-900 dark:text-white line-clamp-1 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                      {anime.title}
                    </h4>
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mt-0.5">
                      <span>{anime.studios.join(', ')}</span>
                      <span>·</span>
                      <span>{anime.format === 'Movie' ? 'Película' : `${anime.episodes || 'TBA'} eps`}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Score Gauge & Action */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-11 sm:pl-0">
                  {/* Score gauge */}
                  <div className="flex items-center gap-3">
                    <div className="hidden md:flex flex-col items-end text-[11px] font-mono text-zinc-400">
                      <span>MAL OFICIAL</span>
                      <div className="w-24 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden mt-1">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${(anime.score / 10) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-mono font-bold text-zinc-900 dark:text-white">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>{anime.score}</span>
                    </div>
                  </div>

                  <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                    <span>Ficha</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {rankedList.length === 0 && (
        <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
          <p className="font-serif text-lg text-zinc-900 dark:text-white font-bold">
            No hay producciones en esta categoría del ranking.
          </p>
          <button
            onClick={() => setCategory('all')}
            className="mt-2 inline-flex items-center px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-xs cursor-pointer shadow-xs"
          >
            Ver Top General
          </button>
        </div>
      )}
    </div>
  );
};
