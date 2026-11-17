import React from 'react';
import { Bookmark } from 'lucide-react';

interface BookmarkButtonProps {
  active: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({ active, onClick, className = '' }) => (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      event.preventDefault();
      onClick(event);
    }}
    aria-pressed={active}
    aria-label={active ? 'Quitar de Mis Guardados' : 'Guardar para leer más tarde'}
    title={active ? 'Quitar de Mis Guardados' : 'Guardar para leer más tarde'}
    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-mono font-bold transition-colors cursor-pointer ${
      active
        ? 'border-amber-400 bg-amber-400/15 text-amber-600 dark:text-amber-400'
        : 'border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/80 text-zinc-500 hover:text-amber-600 hover:border-amber-400'
    } ${className}`}
  >
    <Bookmark className={`w-3.5 h-3.5 ${active ? 'fill-current' : ''}`} />
    <span>{active ? 'Guardado' : 'Guardar'}</span>
  </button>
);
