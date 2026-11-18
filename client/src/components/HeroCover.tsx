import { headline } from '../lib/story.js';
import React, { useState } from 'react';
import { Sparkles, ArrowRight, Clock } from 'lucide-react';
import { NewsItem } from '../types.js';

interface HeroCoverProps {
  story?: NewsItem;
  onSelectStory: (story: NewsItem) => void;
}

export function formatTimeAgo(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Hace un momento';
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} d`;
  } catch {
    return 'Reciente';
  }
}

export const HeroCover: React.FC<HeroCoverProps> = ({ story, onSelectStory }) => {
  const [hasImageError, setHasImageError] = useState(false);

  React.useEffect(() => {
    setHasImageError(false);
  }, [story?.id, story?.imageUrl]);

  if (!story) {
    return (
      <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 animate-pulse">
        <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-4" />
        <div className="h-10 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-lg mb-3" />
        <div className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded mb-6" />
        <div className="h-72 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  const showFallbackBanner = !story.imageUrl || hasImageError;

  return (
    <article
      onClick={() => onSelectStory(story)}
      className="group cursor-pointer w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-200"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Left Editorial Text Column (5 cols) */}
        <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between order-2 lg:order-1">
          <div>
            <div className="flex items-center gap-2 mb-3">
              {story.isRadarFlash ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-extrabold uppercase tracking-wider bg-linear-to-r from-red-600 to-amber-500 text-white shadow-xs animate-pulse">
                  Desde las redes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-red-600 text-white">
                  <Sparkles className="w-3 h-3" />
                  PORTADA PRINCIPAL
                </span>
              )}
              <span className="text-[11px] font-mono font-semibold text-zinc-500 dark:text-zinc-400">
                {story.twitterAuthorHandle || story.category}
              </span>
            </div>

            <h1 className="font-serif font-bold text-2xl sm:text-3xl lg:text-4xl leading-tight text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
              {headline(story.title)}
            </h1>

            {story.summary && (
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-3">
                {story.summary}
              </p>
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-900 dark:text-white">
                {story.sourceName}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(story.publishedAt)}
              </span>
            </div>

            <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400 group-hover:translate-x-0.5 transition-transform">
              Leer nota <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Right High-Impact Image Column (7 cols) */}
        <div className="lg:col-span-7 relative min-h-[260px] sm:min-h-[340px] lg:min-h-[420px] bg-zinc-950 overflow-hidden order-1 lg:order-2 flex items-center justify-center">
          {showFallbackBanner ? (
            <div className="w-full h-full p-8 flex flex-col justify-between bg-gradient-to-br from-zinc-900 via-zinc-950 to-black relative select-none">
              <div className="flex items-center justify-between z-10">
                <span className="px-3 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30">
                  {story.category}
                </span>
                <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-widest">
                  NEKOPRESS
                </span>
              </div>
              <div className="text-center my-auto z-10">
                <p className="font-serif font-black text-3xl sm:text-4xl text-zinc-200 tracking-wider">
                  猫PRESS <span className="text-red-500 text-sm font-mono font-bold px-2 py-0.5 rounded bg-red-500/20">v2</span>
                </p>
                <p className="text-xs font-mono text-zinc-400 mt-2">Agencia: {story.sourceName}</p>
              </div>
              <div className="flex items-center justify-between text-xs font-mono text-zinc-500 border-t border-zinc-800/80 pt-3 z-10">
                <span>INTELIGENCIA ANIME EN TIEMPO REAL</span>
                <span>NOTICIA</span>
              </div>
              <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:20px_20px] opacity-30" />
            </div>
          ) : (
            <img
              src={story.imageUrl}
              alt={headline(story.title)}
              loading="eager"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
              onError={() => setHasImageError(true)}
            />
          )}

          {/* Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent lg:hidden" />
        </div>
      </div>
    </article>
  );
};
