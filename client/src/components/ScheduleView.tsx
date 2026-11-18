import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Tv, ExternalLink, Sparkles, Filter, ChevronRight, Play } from 'lucide-react';
import { ScheduleItem, DayOfWeek, AnimeItem } from '../types.js';
import { broadcastInstant, weekdayIn } from '../lib/scheduleClock.js';
import { PosterImage } from './PosterImage.js';

interface ScheduleViewProps {
  following: number[];
  scheduleItems: ScheduleItem[];
  todayDay: DayOfWeek;
  isLoading: boolean;
  onSelectAnimeById?: (animeId: number) => void;
}

const DAYS: { key: DayOfWeek | 'all'; label: string; short: string }[] = [
  { key: 'all', label: 'Toda la semana', short: 'Todos' },
  { key: 'lunes', label: 'Lunes', short: 'LUN' },
  { key: 'martes', label: 'Martes', short: 'MAR' },
  { key: 'miercoles', label: 'Miércoles', short: 'MIÉ' },
  { key: 'jueves', label: 'Jueves', short: 'JUE' },
  { key: 'viernes', label: 'Viernes', short: 'VIE' },
  { key: 'sabado', label: 'Sábado', short: 'SÁB' },
  { key: 'domingo', label: 'Domingo', short: 'DOM' },
];

const PLATFORMS = ['Todas', 'Crunchyroll', 'Netflix', 'Disney+'];

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  scheduleItems: originals,
  following,
  isLoading,
  onSelectAnimeById,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('Todas');

  const [onlyFollowed, setOnlyFollowed] = useState(false);
  const [clock, setClock] = useState<'local' | 'tokyo'>('local');
  const zone = clock === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Tokyo';
  const todayDay = weekdayIn(new Date(), zone);
  const scheduleItems = useMemo(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('es', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const matches = onlyFollowed ? originals.filter(item => item.animeId !== undefined && following.includes(item.animeId)) : originals;
    return matches.map(item => {
      const instant = broadcastInstant(item, now);
      return { ...item, day: instant ? weekdayIn(instant, zone) : null,
        displayTime: instant ? formatter.format(instant) : 'Hora por confirmar' };
    });
  }, [originals, zone, onlyFollowed, following]);

  // Filter items in memory (instant 0ms)
  const filteredItems = useMemo(() => {
    let result = [...scheduleItems];

    if (selectedDay !== 'all') {
      result = result.filter((item) => item.day === selectedDay);
    }

    if (selectedPlatform !== 'Todas') {
      result = result.filter(
        (item) => item.platform.toLowerCase() === selectedPlatform.toLowerCase()
      );
    }

    return result;
  }, [scheduleItems, selectedDay, selectedPlatform]);

  // Day counts for badge indicators
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    scheduleItems.forEach((item) => {
      if (item.day) counts[item.day] = (counts[item.day] || 0) + 1;
    });
    return counts;
  }, [scheduleItems]);

  const getPlatformBadgeColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'crunchyroll':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'netflix':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'disney+':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header Editorial */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-red-600 text-white">
              SIMULCAST WIRE
            </span>
            <span className="text-xs font-mono text-zinc-500">
              GUÍA DE EMISIONES EN CURSO
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            Calendario Semanal de Estrenos
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Los días y las horas se muestran en {zone.replace(/_/g, ' ')}.
          </p>
        </div>

        {/* Live Day Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-zinc-500">HOY:</span>
          <span className="font-bold text-zinc-900 dark:text-white uppercase">
            {todayDay}
          </span>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={onlyFollowed} onChange={e => setOnlyFollowed(e.target.checked)} /> Solo las que sigo
      </label>
      <label className="flex items-center gap-3 text-sm font-semibold">Zona horaria
        <select value={clock} onChange={e => setClock(e.target.value === 'tokyo' ? 'tokyo' : 'local')}
          className="rounded border border-zinc-400 bg-white px-3 py-2 dark:bg-zinc-900">
          <option value="local">Mi hora local</option><option value="tokyo">Hora de Tokio</option>
        </select>
      </label>
      {/* 2. Weekday Selector Navigation */}
      <div className="bg-white dark:bg-zinc-900/80 p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
        {/* Days Carousel Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {DAYS.map((d) => {
            const isSelected = selectedDay === d.key;
            const isToday = d.key === todayDay;
            const count = d.key === 'all' ? scheduleItems.length : dayCounts[d.key] || 0;

            return (
              <button
                key={d.key}
                onClick={() => setSelectedDay(d.key)}
                className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs font-bold'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <span>{d.label}</span>
                {isToday && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black uppercase bg-red-600 text-white leading-none">
                    HOY
                  </span>
                )}
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-zinc-700 dark:bg-zinc-200 text-zinc-200 dark:text-zinc-800'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Platform Filters */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-mono text-zinc-400 uppercase mr-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Plataforma:</span>
          </span>
          {PLATFORMS.map((platform) => {
            const active = selectedPlatform === platform;
            return (
              <button
                key={platform}
                onClick={() => setSelectedPlatform(platform)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {platform}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Results Header */}
      <div className="flex items-center justify-between text-xs font-mono text-zinc-500 px-1">
        <span>
          MOSTRANDO {filteredItems.length} EMISIONES PROGRAMADAS
        </span>
        {(selectedDay !== 'all' || selectedPlatform !== 'Todas') && (
          <button
            onClick={() => {
              setOnlyFollowed(false);
              setSelectedDay('all');
              setSelectedPlatform('Todas');
            }}
            className="text-red-600 hover:underline cursor-pointer font-sans"
          >
            Ver toda la semana
          </button>
        )}
      </div>

      {/* 4. Loading Skeleton */}
      {isLoading && scheduleItems.length === 0 && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-zinc-200 dark:bg-zinc-800 rounded-xl h-32 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* 5. Schedule Items List / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map((item) => {
          const isToday = item.day === todayDay;

          return (
            <article
              key={item.id}
              className={`flex flex-col sm:flex-row bg-white dark:bg-zinc-900 border rounded-xl overflow-hidden hover:shadow-md transition-all duration-150 ${
                isToday
                  ? 'border-red-500/40 dark:border-red-500/30 ring-1 ring-red-500/20'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              {/* Cover Poster */}
              <div className="sm:w-36 aspect-[3/4.2] sm:aspect-auto shrink-0 relative bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <PosterImage
                  src={item.imageUrl}
                  title={item.title}
                  subtitle={item.studio}
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover"
                />

                {/* Day Tag overlay */}
                <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-zinc-950/85 text-white backdrop-blur">
                    {item.day ?? 'Por confirmar'}
                  </span>
                  {isToday && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-red-600 text-white animate-pulse">
                      HOY
                    </span>
                  )}
                </div>
              </div>

              {/* Information Body */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  {/* Broadcast Time & Platform */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-red-600" />
                      <span>{item.displayTime}</span>
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded border text-[11px] font-bold ${getPlatformBadgeColor(
                        item.platform
                      )}`}
                    >
                      {item.platform}
                    </span>
                  </div>

                  {/* Japanese Native Subtitle */}
                  {item.titleJapanese && (
                    <p className="font-jp text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-1 notranslate" translate="no">
                      {item.titleJapanese}
                    </p>
                  )}

                  {/* Title */}
                  <h3 className="font-serif font-bold text-base text-zinc-900 dark:text-white line-clamp-1 notranslate" translate="no">
                    {item.title}
                  </h3>

                  {/* Synopsis */}
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {item.synopsisPreview}
                  </p>
                </div>

                {/* Footer specs & actions */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 notranslate" translate="no">
                      {item.studio}
                    </span>
                    {item.currentEpisode && (
                      <>
                        <span>·</span>
                        <span className="text-zinc-400 notranslate" translate="no">Ep. #{item.currentEpisode}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.animeId && onSelectAnimeById && (
                      <button
                        onClick={() => onSelectAnimeById(item.animeId!)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer notranslate"
                        translate="no"
                      >
                        Ver Ficha
                      </button>
                    )}

                    {item.platformUrl && (
                      <a
                        href={item.platformUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 shadow-2xs transition-all cursor-pointer notranslate"
                        translate="no"
                      >
                        <span>Ver en {item.platform}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && !isLoading && (
        <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
          <p className="font-serif text-lg text-zinc-900 dark:text-white font-bold">
            No hay emisiones programadas con los filtros seleccionados.
          </p>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            {onlyFollowed && following.length === 0 ? 'Abre la ficha de un anime y pulsa «Seguir serie».' : 'Prueba otro día o restablece los filtros.'}
          </p>
          <button
            onClick={() => {
              setOnlyFollowed(false);
              setSelectedDay('all');
              setSelectedPlatform('Todas');
            }}
            className="mt-2 inline-flex items-center px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-xs cursor-pointer shadow-xs"
          >
            Ver toda la semana
          </button>
        </div>
      )}
    </div>
  );
};
