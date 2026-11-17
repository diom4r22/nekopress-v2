import React from 'react';
import {
  Flame,
  Film,
  Calendar,
  Trophy,
  Bookmark,
  RefreshCw,
  Sun,
  Moon,
} from 'lucide-react';

interface LeftIconRailProps {
  currentSection: 'news' | 'catalog' | 'schedule' | 'ranking';
  onSectionChange: (section: 'news' | 'catalog' | 'schedule' | 'ranking') => void;
  savedCount: number;
  onOpenSaved: () => void;
  isSyncing: boolean;
  onSync: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  tokyoTime: string;
}

export const LeftIconRail: React.FC<LeftIconRailProps> = ({
  currentSection,
  onSectionChange,
  savedCount,
  onOpenSaved,
  isSyncing,
  onSync,
  isDark,
  onToggleTheme,
  tokyoTime,
}) => {
  const navItems: Array<{
    id: 'news' | 'catalog' | 'schedule' | 'ranking';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'news', label: 'Portada & Noticias', icon: Flame },
    { id: 'catalog', label: 'Catálogo Anime', icon: Film },
    { id: 'schedule', label: 'Simulcast JST', icon: Calendar },
    { id: 'ranking', label: 'Ranking Oficial', icon: Trophy },
  ];

  return (
    <aside
      aria-label="Navegación principal"
      className="fixed left-0 top-0 bottom-0 w-16 z-50 border-r bg-white dark:bg-[#0c0c10] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white flex flex-col items-center justify-between py-4 select-none transition-colors"
    >
      {/* Top Geometric Brand Emblem */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => onSectionChange('news')}
          title="NekoPress"
          className="w-10 h-10 -skew-x-6 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center font-jp font-black text-xl shadow-md cursor-pointer hover:scale-105 transition-transform"
        >
          <span className="skew-x-6">猫</span>
        </button>
        <span className="text-[9px] font-mono tracking-tighter text-zinc-500 dark:text-zinc-400">
          {tokyoTime}
        </span>
      </div>

      {/* Center Section Navigation */}
      <nav className="flex flex-col items-center gap-3 w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              title={item.label}
              aria-label={item.label}
              className={`group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                active
                  ? 'bg-red-600/10 text-red-600 dark:bg-white/10 dark:text-white shadow-inner'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
              }`}
            >
              {active && (
                <span className="absolute -left-2.5 w-1 h-6 rounded-r bg-red-600" />
              )}
              <Icon className={`w-5 h-5 ${active ? 'text-red-600 dark:text-red-500' : ''}`} />
              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute left-14 px-2.5 py-1 rounded bg-zinc-900 dark:bg-zinc-900 text-white border border-zinc-700 dark:border-white/10 text-[11px] font-semibold whitespace-nowrap shadow-xl z-50">
                {item.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenSaved}
          title={`Guardados (${savedCount})`}
          aria-label="Mis Guardados"
          className="group relative w-11 h-11 rounded-xl flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-all cursor-pointer"
        >
          <Bookmark className={`w-5 h-5 ${savedCount > 0 ? 'text-amber-500 fill-amber-500' : ''}`} />
          {savedCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-400 text-black text-[9px] font-mono font-black flex items-center justify-center">
              {savedCount > 9 ? '9+' : savedCount}
            </span>
          )}
          <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute left-14 px-2.5 py-1 rounded bg-zinc-900 text-white border border-zinc-700 dark:border-white/10 text-[11px] font-semibold whitespace-nowrap shadow-xl z-50">
            Mis Guardados
          </span>
        </button>
      </nav>

      {/* Bottom Action Controls */}
      <div className="flex flex-col items-center gap-2.5">
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          title="Sincronizar cables en vivo"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-red-600' : ''}`} />
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
