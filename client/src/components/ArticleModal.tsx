import React, { useEffect } from 'react';
import { X, ExternalLink, Calendar, User, Tag, Share2, Check } from 'lucide-react';
import { headline, storyText, videoId } from '../lib/story.js';
import { AnimeItem, NewsItem } from '../types.js';
import { formatTimeAgo } from './HeroCover.js';
import { BookmarkButton } from './BookmarkButton.js';

interface ArticleModalProps {
  article: NewsItem | null;
  linkedAnime?: AnimeItem;
  nextAiringAt?: number | null;
  onOpenAnime?: (anime: AnimeItem) => void;
  onClose: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (item: NewsItem) => void;
  relatedArticles?: NewsItem[];
  onSelectArticle?: (item: NewsItem) => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({
  article,
  onClose,
  isBookmarked = false,
  onToggleBookmark,
  linkedAnime, nextAiringAt, onOpenAnime,
  relatedArticles = [],
  onSelectArticle,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);

  useEffect(() => {
    setImgError(false);
  }, [article?.id, article?.imageUrl]);

  useEffect(() => {
    if (!article) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, article]);

  const [playingId, setPlayingId] = React.useState<string | null>(null);
  useEffect(() => setPlayingId(null), [article?.id]);
  if (!article) return null;
  const video = videoId(article.url);
  const story = storyText(article);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(article.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
      >
        {/* Top Control Bar */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-red-600 text-white">
              {article.category}
            </span>

            <span className="text-xs text-zinc-500 font-medium">
              {article.isRadarFlash
                ? `Vía ${article.twitterAuthorHandle || article.sourceName}`
                : `Vía ${article.sourceName}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              title="Copiar enlace"
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 text-xs flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copiado' : 'Compartir'}</span>
            </button>

            <button
              aria-label="Cerrar noticia"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Article Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          <h2 className="font-serif font-black text-2xl sm:text-3xl text-zinc-900 dark:text-white leading-tight">
            {story.title}
          </h2>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(article.publishedAt).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })} ({formatTimeAgo(article.publishedAt)})
            </span>

            {article.author && (
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {article.author}
              </span>
            )}
          </div>

          {video && (playingId === video
            ? <iframe className="aspect-video w-full rounded-xl" title={story.title} src={`https://www.youtube-nocookie.com/embed/${video}?autoplay=1`} allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
            : <button type="button" className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-xl bg-zinc-950 text-white" onClick={() => setPlayingId(video)}>
                {article.imageUrl && !imgError && <img className="absolute inset-0 h-full w-full object-cover opacity-60" src={article.imageUrl} alt="" onError={() => setImgError(true)} />}
                <span className="relative rounded-full bg-red-700 px-5 py-3 font-bold">▶ Reproducir video</span>
              </button>)}
          {video && linkedAnime && onOpenAnime && <section className="border-l-4 border-red-600 pl-4">
            <h3 className="font-serif text-xl font-bold">{linkedAnime.title}</h3>
            {nextAiringAt && <p className="my-1 text-sm">Próxima emisión · <time dateTime={new Date(nextAiringAt * 1000).toISOString()}>
              {new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(nextAiringAt * 1000)}
            </time></p>}
            <button className="mt-1 text-sm font-semibold underline" onClick={() => onOpenAnime(linkedAnime)}>Ver ficha de {linkedAnime.title}</button>
          </section>}
          {!video && article.imageUrl && !imgError && (
            <div className="relative w-full max-h-[480px] rounded-xl overflow-hidden bg-zinc-950 shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
              <img
                src={article.imageUrl}
                alt={story.title}
                referrerPolicy="no-referrer"
                className="w-full max-h-[480px] object-contain sm:object-cover sm:object-top"
                onError={() => setImgError(true)}
              />
            </div>
          )}

          {/* Entradilla / Lead Informativo */}
          {story.intro && (
            <div className="border-l-4 border-red-600 pl-4 py-1.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-r-lg">
              <p className="font-serif font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 leading-snug">
                {story.intro}
              </p>
            </div>
          )}

          {/* Cuerpo Completo del Artículo con Deduplicación Inteligente */}
          <div className="space-y-4 text-zinc-800 dark:text-zinc-200 text-sm sm:text-base leading-relaxed font-sans">
            {story.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            {!story.intro && !video && <p>Puedes leer la noticia completa en {article.sourceName}.</p>}
          </div>

          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              {article.tags.filter(tag => !/^(radarx|primicia)$/i.test(tag)).map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {!!article.coverage?.length && <section className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h3 className="font-serif text-xl font-bold">Más cobertura</h3>
            <ul className="mt-2 space-y-2">{article.coverage.map(source =>
              <li key={source.url}><a className="block rounded p-2 hover:underline" href={source.url} target="_blank" rel="noreferrer">
                <span className="block text-xs text-zinc-500">{source.name}</span>{headline(source.title)}
              </a></li>)}</ul>
          </section>}

          {relatedArticles.length > 0 && onSelectArticle && (
            <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                Más noticias de {article.category}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {relatedArticles.slice(0, 3).map((rel) => (
                  <button
                    key={rel.id}
                    type="button"
                    onClick={() => onSelectArticle(rel)}
                    className="text-left p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:border-red-500/40 transition-colors cursor-pointer"
                  >
                    <p className="text-[10px] font-mono text-zinc-500 mb-1 truncate">
                      {rel.sourceName} · {formatTimeAgo(rel.publishedAt)}
                    </p>
                    <p className="font-serif font-bold text-xs text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug">
                      {headline(rel.title)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Sticky CTA */}
        <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onToggleBookmark && (
              <BookmarkButton
                active={isBookmarked}
                onClick={() => onToggleBookmark(article)}
                className="py-2.5 px-3 text-xs"
              />
            )}
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-xs sm:text-sm shadow-xs transition-all active:scale-95 cursor-pointer ${
                article.isRadarFlash
                  ? 'bg-black hover:bg-zinc-800 border border-zinc-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <span>
                {article.isRadarFlash
                  ? article.url.includes('bsky.app')
                    ? `Ver publicación original en Bluesky (${article.twitterAuthorHandle || article.sourceName})`
                    : `Ver en X (${article.twitterAuthorHandle || 'Publicación Original'})`
                  : video ? 'Ver en YouTube' : `Leer en ${article.sourceName}`}
              </span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
