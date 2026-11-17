import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Star,
  Film,
  SlidersHorizontal,
  X,
  Tv,
  Building2,
  Globe,
  Award,
  Sparkles,
  ExternalLink,
  Calendar,
  Layers,
} from 'lucide-react';
import { AnimeItem, StudioSummary } from '../types.js';
import { BookmarkButton } from './BookmarkButton.js';
import { PosterImage } from './PosterImage.js';

interface AnimeCatalogProps {
  catalog: AnimeItem[];
  isLoading: boolean;
  onSelectAnime: (anime: AnimeItem) => void;
  isBookmarked?: (kind: 'anime', id: string) => boolean;
  onToggleBookmark?: (anime: AnimeItem) => void;
}

const STUDIOS = [
  'Todos',
  'MAPPA',
  'ufotable',
  'Bones',
  'Madhouse',
  'Wit Studio',
  'CloverWorks',
  'Toei Animation',
  'Science SARU',
  'Production I.G',
  'White Fox',
];

const FORMATS = [
  { label: 'Todos', value: 'all' },
  { label: 'Series TV', value: 'tv' },
  { label: 'Películas', value: 'movie' },
  { label: 'En Emisión', value: 'airing' },
];

export const AnimeCatalog: React.FC<AnimeCatalogProps> = ({
  catalog,
  isLoading,
  onSelectAnime,
  isBookmarked,
  onToggleBookmark,
}) => {
  const [search, setSearch] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [selectedStudio, setSelectedStudio] = useState<string>('Todos');
  const [studioStatusFilter, setStudioStatusFilter] = useState<'all' | 'finished' | 'airing'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'popularity' | 'title'>('score');
  const [visibleCount, setVisibleCount] = useState<number>(30);
  const [studiosSummary, setStudiosSummary] = useState<StudioSummary[]>([]);

  useEffect(() => {
    setVisibleCount(30);
  }, [search, selectedFormat, selectedStudio, studioStatusFilter, sortBy]);

  // Fetch official studio metadata on mount
  useEffect(() => {
    fetch('/api/studios')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && Array.isArray(json.data)) {
          setStudiosSummary(json.data);
        }
      })
      .catch((err) => console.warn('No se pudo cargar el índice de estudios:', err));
  }, []);

  // Selected studio metadata
  const currentStudioMeta = useMemo(() => {
    if (selectedStudio === 'Todos') return null;
    return (
      studiosSummary.find(
        (s) => s.name.toLowerCase() === selectedStudio.toLowerCase()
      ) || null
    );
  }, [selectedStudio, studiosSummary]);

  // Filtering & Sorting (instant client-side, zero network delay)
  const filteredCatalog = useMemo(() => {
    let result = [...catalog];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((item) => {
        const inTitle = item.title.toLowerCase().includes(q);
        const inEng = (item.titleEnglish || '').toLowerCase().includes(q);
        const inJp = (item.titleJapanese || '').toLowerCase().includes(q);
        const inStudio = item.studios.some((s) => s.toLowerCase().includes(q));
        const inGenre = item.genres.some((g) => g.toLowerCase().includes(q));
        return inTitle || inEng || inJp || inStudio || inGenre;
      });
    }

    if (selectedFormat === 'tv') {
      result = result.filter((a) => a.format === 'TV');
    } else if (selectedFormat === 'movie') {
      result = result.filter((a) => a.format === 'Movie');
    } else if (selectedFormat === 'airing') {
      result = result.filter((a) => a.airing);
    }

    if (selectedStudio !== 'Todos') {
      result = result.filter((a) =>
        a.studios.some((s) => s.toLowerCase().includes(selectedStudio.toLowerCase()))
      );

      // Studio sub-status filter (Consagradas vs En Emisión)
      if (studioStatusFilter === 'finished') {
        result = result.filter((a) => a.status === 'Finalizado');
      } else if (studioStatusFilter === 'airing') {
        result = result.filter((a) => a.status === 'En Emisión' || a.status === 'Próximamente');
      }
    }

    if (sortBy === 'score') {
      result.sort((a, b) => b.score - a.score);
    } else if (sortBy === 'popularity') {
      result.sort((a, b) => {
        const popA = a.popularity ?? 9999;
        const popB = b.popularity ?? 9999;
        if (popA > 1000 || popB > 1000) return popB - popA;
        return popA - popB;
      });
    } else if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [catalog, search, selectedFormat, selectedStudio, studioStatusFilter, sortBy]);

  const resetFilters = () => {
    setSearch('');
    setSelectedFormat('all');
    setSelectedStudio('Todos');
    setStudioStatusFilter('all');
    setSortBy('score');
  };

  return (
    <div className="space-y-6">
      {/* 1. Sleek Editorial Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-red-600 text-white">
              DOSSIERS CANÓNICOS
            </span>
            <span className="text-xs font-mono text-zinc-500">
              {catalog.length} PRODUCCIONES AUDITADAS
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            Catálogo Editorial de Producciones & Estudios
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Filmografías canónicas verificadas de los 10 mayores estudios de animación, sin datos ficticios.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por anime, estudio o género..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600 shadow-2xs transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Controls Toolbar: Formats, Studios, Sorting */}
      <div className="space-y-3 bg-white dark:bg-zinc-900/80 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
        {/* Row 1: Formats & Sorter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Format pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-mono text-zinc-400 uppercase mr-1 shrink-0">
              Formato:
            </span>
            {FORMATS.map((f) => {
              const active = selectedFormat === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setSelectedFormat(f.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>ORDEN:</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'score' | 'popularity' | 'title')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600 cursor-pointer"
            >
              <option value="score">★ Calificación (MAL)</option>
              <option value="popularity">🔥 Popularidad</option>
              <option value="title">🔤 Título (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Studio filter chips */}
        <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-mono text-zinc-400 uppercase mr-1 shrink-0">
            Estudios:
          </span>
          {STUDIOS.map((studio) => {
            const active = selectedStudio === studio;
            return (
              <button
                key={studio}
                onClick={() => {
                  setSelectedStudio(studio);
                  setStudioStatusFilter('all');
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-red-600 text-white font-bold shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900'
                }`}
              >
                {studio}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2.1 Studio Dossier Highlight Banner (When a specific studio is chosen) */}
      {currentStudioMeta && (
        <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 text-white rounded-2xl p-5 sm:p-6 border border-zinc-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-red-600 text-white">
                  EXPEDIENTE DE ESTUDIO OFICIAL
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  {currentStudioMeta.headquarters}
                </span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-black text-white">
                {currentStudioMeta.name}
              </h2>
              <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
                {currentStudioMeta.philosophy}
              </p>
            </div>

            <div className="flex items-center gap-4 self-start sm:self-auto shrink-0">
              <div className="bg-zinc-800/80 px-3.5 py-2 rounded-xl border border-zinc-700/80 text-center">
                <div className="text-[10px] font-mono uppercase text-zinc-400">Media MAL</div>
                <div className="text-lg font-mono font-bold text-amber-400 flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>{currentStudioMeta.averageScore}</span>
                </div>
              </div>
              <div className="bg-zinc-800/80 px-3.5 py-2 rounded-xl border border-zinc-700/80 text-center">
                <div className="text-[10px] font-mono uppercase text-zinc-400">Fundación</div>
                <div className="text-lg font-mono font-bold text-zinc-200">
                  {currentStudioMeta.foundedYear}
                </div>
              </div>
              {currentStudioMeta.officialSite && (
                <a
                  href={currentStudioMeta.officialSite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Web Oficial ↗</span>
                </a>
              )}
            </div>
          </div>

          {/* Studio Sub-filters: All, Finished Masterpieces, Airing */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-zinc-400 uppercase mr-1">
                Sección del Estudio:
              </span>
              <button
                onClick={() => setStudioStatusFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                  studioStatusFilter === 'all'
                    ? 'bg-white text-zinc-950 font-bold'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                Todas las obras
              </button>
              <button
                onClick={() => setStudioStatusFilter('finished')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  studioStatusFilter === 'finished'
                    ? 'bg-amber-400 text-zinc-950 font-bold'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <Award className="w-3 h-3" />
                <span>Obras Maestras Consagradas</span>
              </button>
              <button
                onClick={() => setStudioStatusFilter('airing')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  studioStatusFilter === 'airing'
                    ? 'bg-emerald-500 text-white font-bold'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>En Emisión / Próximamente</span>
              </button>
            </div>

            <div className="text-xs font-mono text-zinc-400">
              Fundadores: <span className="text-zinc-200">{currentStudioMeta.keyFounders}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Results Counter */}
      <div className="flex items-center justify-between text-xs font-mono text-zinc-500 px-1">
        <span>
          MOSTRANDO {filteredCatalog.length} DE {catalog.length} PRODUCCIONES SELECCIONADAS
        </span>
        {(search || selectedFormat !== 'all' || selectedStudio !== 'Todos' || studioStatusFilter !== 'all') && (
          <button
            onClick={resetFilters}
            className="text-red-600 hover:underline cursor-pointer font-sans font-medium"
          >
            Limpiar todos los filtros
          </button>
        )}
      </div>

      {/* 4. Loading Skeleton (Only during initial fetch when catalog is strictly empty) */}
      {isLoading && catalog.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-zinc-200 dark:bg-zinc-800 rounded-xl overflow-hidden animate-pulse aspect-[3/4.5]"
            />
          ))}
        </div>
      )}

      {/* 5. Production Cards Grid */}
      {filteredCatalog.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {filteredCatalog.slice(0, visibleCount).map((anime) => (
            <article
              key={anime.id}
              onClick={() => onSelectAnime(anime)}
              className="group flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-1"
            >
              {/* Poster frame */}
              <div className="relative aspect-[3/4.2] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <PosterImage
                  src={anime.imageUrl}
                  title={anime.title}
                  subtitle={anime.studios[0]}
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Star score badge */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950/85 text-amber-400 font-mono text-[11px] font-bold backdrop-blur shadow-xs">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{anime.score}</span>
                </div>

                {/* Format & Airing badges */}
                <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-950/85 text-white uppercase backdrop-blur">
                    {anime.format === 'Movie' ? 'PELÍCULA' : anime.format}
                  </span>
                  {anime.airing && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-600 text-white uppercase animate-pulse shadow-xs">
                      EN EMISIÓN
                    </span>
                  )}
                  {anime.status === 'Próximamente' && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-600 text-white uppercase shadow-xs">
                      PRÓXIMAMENTE
                    </span>
                  )}
                </div>

                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <span className="text-[11px] font-semibold text-white font-mono flex items-center gap-1">
                    Abrir expediente técnico →
                  </span>
                </div>
              </div>

              {/* Info body */}
              <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  {/* Japanese title */}
                  {anime.titleJapanese && (
                    <p className="font-jp text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-1 mb-0.5">
                      {anime.titleJapanese}
                    </p>
                  )}

                  {/* Main Title */}
                  <h3 className="font-serif font-bold text-sm sm:text-base text-zinc-900 dark:text-white line-clamp-2 leading-snug group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    {anime.title}
                  </h3>
                </div>

                {/* Studios, episodes and genre tags */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px] font-mono text-zinc-500">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-700 dark:text-zinc-300 font-semibold truncate max-w-[65%]">
                      {anime.studios.join(', ')}
                    </span>
                    <span className="text-zinc-400 font-bold shrink-0">
                      {anime.episodes ? `${anime.episodes} eps` : anime.airing ? 'En emisión' : anime.year || '2025'}
                    </span>
                  </div>

                  {/* Genre chips & Bookmark button */}
                  <div className="flex items-center justify-between gap-1 pt-1">
                    <div className="flex flex-wrap gap-1">
                      {anime.genres.slice(0, 2).map((genre) => (
                        <span
                          key={genre}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                    {onToggleBookmark && isBookmarked && (
                      <BookmarkButton
                        active={isBookmarked('anime', String(anime.id))}
                        onClick={() => onToggleBookmark(anime)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
          </div>

          {filteredCatalog.length > visibleCount && (
            <div className="pt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 30)}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-zinc-200 dark:bg-zinc-900 hover:bg-zinc-300 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-mono font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors"
              >
                Cargar más producciones ({filteredCatalog.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </>
      )}

      {/* 6. Empty State */}
      {!isLoading && filteredCatalog.length === 0 && (
        <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
          <p className="font-serif text-lg text-zinc-900 dark:text-white font-bold">
            No se encontraron producciones que coincidan con los filtros.
          </p>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Prueba ajustando el término de búsqueda, seleccionando otro formato o restableciendo los estudios.
          </p>
          <button
            onClick={resetFilters}
            className="mt-2 inline-flex items-center px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-xs cursor-pointer shadow-xs"
          >
            Restablecer todos los filtros
          </button>
        </div>
      )}
    </div>
  );
};
