import React, { useEffect } from 'react';
import { X, ExternalLink, Calendar, User, Tag, Share2, Check } from 'lucide-react';
import { NewsItem } from '../types.js';
import { formatTimeAgo } from './HeroCover.js';
import { BookmarkButton } from './BookmarkButton.js';

interface ArticleModalProps {
  article: NewsItem | null;
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
  relatedArticles = [],
  onSelectArticle,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);

  useEffect(() => {
    setImgError(false);
  }, [article?.id, article?.imageUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!article) return null;

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

            {article.verificationBadge === 'verified_official' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                ✓ Oficial Confirmado
              </span>
            )}

            {article.verificationBadge === 'leaker_scoop' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                ⚡ Primicia Radar X
              </span>
            )}

            {article.verificationBadge === 'industry_report' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                📊 Reporte de Industria
              </span>
            )}

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
            {article.title}
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

          {article.imageUrl && !imgError && (
            <div className="relative w-full max-h-[480px] rounded-xl overflow-hidden bg-zinc-950 shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
              <img
                src={article.imageUrl}
                alt={article.title}
                referrerPolicy="no-referrer"
                className="w-full max-h-[480px] object-contain sm:object-cover sm:object-top"
                onError={() => setImgError(true)}
              />
            </div>
          )}

          {/* Entradilla / Lead Informativo */}
          {article.lead && (
            <div className="border-l-4 border-red-600 pl-4 py-1.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-r-lg">
              <p className="font-serif font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 leading-snug">
                {article.lead}
              </p>
            </div>
          )}

          {/* Cuerpo Completo del Artículo con Deduplicación Inteligente */}
          <div className="space-y-4 text-zinc-800 dark:text-zinc-200 text-sm sm:text-base leading-relaxed font-sans">
            {(() => {
              const leadClean = (article.lead || '').trim().toLowerCase();
              const paragraphs = (article.content || article.summary || '')
                .split('\n\n')
                .map((p) => p.trim())
                .filter((p) => {
                  if (p.length === 0) return false;
                  if (p.startsWith('Despacho verificado emitido por ')) return false;
                  // Si el párrafo es idéntico a la entradilla o está contenido en un 90%, se omite para evitar redundancia
                  const pClean = p.toLowerCase();
                  if (leadClean && (pClean === leadClean || leadClean.startsWith(pClean) || pClean.startsWith(leadClean))) {
                    return false;
                  }
                  return true;
                });

              // Si todos los párrafos coincidían con el lead y ya mostramos el lead arriba, evitamos repetirlo
              const displayParagraphs =
                paragraphs.length > 0
                  ? paragraphs
                  : !article.lead
                  ? [article.summary || '']
                  : [];

              return displayParagraphs.map((paragraph, idx) => (
                <p key={idx} className="text-zinc-700 dark:text-zinc-300">
                  {paragraph}
                </p>
              ));
            })()}
          </div>

          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {relatedArticles.length > 0 && onSelectArticle && (
            <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                Más despachos de {article.category}
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
                      {rel.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Sticky CTA */}
        <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 font-mono text-center sm:text-left flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>
              {article.isRadarFlash
                ? (article.curatedByAi
                    ? 'Crónica curada por Redacción Editorial Neural'
                    : 'Despacho flash verificado por Radar X')
                : 'Despacho periodístico verificado por NekoPress v2'}
            </span>
          </div>

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
                  : `Leer comunicado original en ${article.sourceName}`}
              </span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
