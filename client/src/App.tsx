import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LeftIconRail } from './components/LeftIconRail.js';
import { MockupNewsLayout } from './components/MockupShowcase.js';
import { ArticleModal } from './components/ArticleModal.js';
import { AnimeCatalog } from './components/AnimeCatalog.js';
import { AnimeModal } from './components/AnimeModal.js';
import { ScheduleView } from './components/ScheduleView.js';
import { RankingView } from './components/RankingView.js';
import { SavedModal } from './components/SavedModal.js';
import {
  SavedItem,
  readSaved,
  writeSaved,
  BookmarkKind,
} from './lib/bookmarks.js';
import { NewsItem, AnimeItem, ScheduleItem, DayOfWeek } from './types.js';

const CATEGORIES = ['Todas', 'Anime', 'Manga', 'Películas', 'Streaming', 'Videojuegos', 'Industria'];

export const App: React.FC = () => {
  // Navigation section
  const [currentSection, setCurrentSection] = useState<'news' | 'catalog' | 'schedule' | 'ranking'>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/ranking')) return 'ranking';
    if (path.startsWith('/calendario')) return 'schedule';
    if (path.startsWith('/anime')) return 'catalog';
    return 'news';
  });

  const [allNews, setAllNews] = useState<NewsItem[]>([]);
  const allNewsRef = useRef<NewsItem[]>([]);
  allNewsRef.current = allNews;
  const [catalog, setCatalog] = useState<AnimeItem[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [todayDay, setTodayDay] = useState<DayOfWeek>('sabado');

  const [catalogLoading, setCatalogLoading] = useState<boolean>(true);
  const [scheduleLoading, setScheduleLoading] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [tokyoTime, setTokyoTime] = useState<string>(() =>
    new Intl.DateTimeFormat('es-ES', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }).format(new Date())
  );

  useEffect(() => {
    const id = setInterval(() => {
      setTokyoTime(
        new Intl.DateTimeFormat('es-ES', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }).format(new Date())
      );
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'rss' | 'radar'>('all');
  const [visibleCount, setVisibleCount] = useState<number>(22);
  
  // Modals
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);

  // Saved / Bookmarks state
  const [savedItems, setSavedItems] = useState<SavedItem[]>(() => readSaved());
  const [isSavedModalOpen, setIsSavedModalOpen] = useState<boolean>(false);

  const isBookmarked = useCallback(
    (kind: BookmarkKind, id: string | number) => {
      const key = String(id);
      return savedItems.some((s) => s.kind === kind && s.id === key);
    },
    [savedItems]
  );

  const handleToggleBookmark = useCallback(
    (kind: BookmarkKind, item: NewsItem | AnimeItem) => {
      const id = kind === 'news' ? (item as NewsItem).id : String((item as AnimeItem).id);
      setSavedItems((prev) => {
        const exists = prev.some((s) => s.kind === kind && s.id === id);
        let updated: SavedItem[];
        if (exists) {
          updated = prev.filter((s) => !(s.kind === kind && s.id === id));
        } else {
          const newItem: SavedItem = {
            kind,
            id,
            savedAt: new Date().toISOString(),
            item: item as any,
          };
          updated = [newItem, ...prev];
        }
        writeSaved(updated);
        return updated;
      });
    },
    []
  );

  // Theme state (Shibuya Stream #1 cinematic dark by default)
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('nekopress-theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    localStorage.setItem('nekopress-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Fetch anime catalog & schedule once on mount
  useEffect(() => {
    // 1. Anime catalog
    fetch('/api/anime')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && Array.isArray(json.data)) {
          setCatalog(json.data);

          // Deep linking check for /anime/:id
          const matchAnime = window.location.pathname.match(/\/anime\/(\d+)/);
          if (matchAnime && matchAnime[1]) {
            const found = json.data.find((a: AnimeItem) => a.id === parseInt(matchAnime[1], 10));
            if (found) setSelectedAnime(found);
          }
        }
      })
      .catch((err) => console.error('Error al cargar catálogo canónico:', err))
      .finally(() => setCatalogLoading(false));

    // 2. Simulcast weekly schedule
    fetch('/api/schedule')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && Array.isArray(json.data)) {
          setScheduleItems(json.data);
          if (json.today) setTodayDay(json.today);
        }
      })
      .catch((err) => console.error('Error al cargar calendario de emisiones:', err))
      .finally(() => setScheduleLoading(false));
  }, []);

  const newsRequest = useRef<AbortController>();

  // Fetch news from backend
  const fetchNews = useCallback(async (isManual = false) => {
    if (newsRequest.current && !isManual) return;
    newsRequest.current?.abort();
    const controller = new AbortController();
    newsRequest.current = controller;
    if (isManual) setIsSyncing(true);
    try {
      const collected: NewsItem[] = [];
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const response = await fetch(`/api/news?limit=50&page=${page}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Error al cargar noticias: ${response.status}`);
        const json = await response.json();
        if (!Array.isArray(json.data)) throw new Error('Respuesta de noticias inválida');
        collected.push(...json.data);
        if (controller.signal.aborted) return;
        if (page === 1) {
          setAllNews(previous => previous.length ? previous : json.data);
          setIsLoading(false);
        }
        hasNext = Boolean(json.pagination?.hasNext) && json.data.length > 0;
        page++;
      }
      setAllNews([...new Map(collected.map(item => [item.id, item])).values()]);
    } catch (err) {
      if (!controller.signal.aborted) console.error('Error al conectar con la API de noticias:', err);
    } finally {
      if (newsRequest.current === controller) {
        newsRequest.current = undefined;
        setIsLoading(false);
        setIsSyncing(false);
      }
    }
  }, []);

  // Handle URL deep-linking on popstate & 60s News Polling
  useEffect(() => {
    fetchNews();

    const pollTimer = setInterval(() => {
      fetchNews();
    }, 60000);

    let articleRequest: AbortController | undefined;
    const handlePopState = () => {
      articleRequest?.abort();
      const path = window.location.pathname;

      if (path.startsWith('/ranking')) {
        setCurrentSection('ranking');
        setSelectedAnime(null);
        setSelectedArticle(null);
      } else if (path.startsWith('/calendario')) {
        setCurrentSection('schedule');
        setSelectedAnime(null);
        setSelectedArticle(null);
      } else if (path.startsWith('/anime')) {
        setCurrentSection('catalog');
        const matchAnime = path.match(/\/anime\/(\d+)/);
        if (matchAnime && matchAnime[1]) {
          const id = parseInt(matchAnime[1], 10);
          fetch(`/api/anime/${id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((json) => {
              if (json && json.data) setSelectedAnime(json.data);
            })
            .catch(() => {});
        } else {
          setSelectedAnime(null);
        }
        setSelectedArticle(null);
      } else {
        setCurrentSection('news');
        setSelectedAnime(null);
        const matchNews = path.match(/\/noticias\/([^/?#]+)/);
        if (matchNews && matchNews[1]) {
          const found = allNewsRef.current.find((n) => n.slug === matchNews[1]);
          setSelectedArticle(found ?? null);
          if (!found) {
            articleRequest = new AbortController();
            const signal = articleRequest.signal;
            fetch(`/api/news/${matchNews[1]}`, { signal })
              .then(response => response.ok ? response.json() : null)
              .then(json => {
                if (json?.data && !signal.aborted && window.location.pathname === path) setSelectedArticle(json.data);
              })
              .catch(() => {});
          }
        } else {
          setSelectedArticle(null);
        }
      }
    };

    handlePopState();
    window.addEventListener('popstate', handlePopState);

    return () => {
      articleRequest?.abort();
      newsRequest.current?.abort();
      newsRequest.current = undefined;
      clearInterval(pollTimer);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [fetchNews]);

  // Section switcher
  const handleSectionChange = useCallback((section: 'news' | 'catalog' | 'schedule' | 'ranking') => {
    setCurrentSection(section);
    if (section === 'ranking') {
      window.history.pushState({}, '', '/ranking');
    } else if (section === 'schedule') {
      window.history.pushState({}, '', '/calendario');
    } else if (section === 'catalog') {
      window.history.pushState({}, '', '/anime');
    } else {
      window.history.pushState({}, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Article selection
  const handleSelectArticle = useCallback((article: NewsItem) => {
    setSelectedArticle(article);
    window.history.pushState({ slug: article.slug }, '', `/noticias/${article.slug}`);
  }, []);

  const handleCloseArticle = useCallback(() => {
    setSelectedArticle(null);
    let backUrl = '/';
    if (currentSection === 'catalog') {
      backUrl = selectedAnime ? `/anime/${selectedAnime.id}` : '/anime';
    } else if (currentSection === 'schedule') {
      backUrl = '/calendario';
    } else if (currentSection === 'ranking') {
      backUrl = '/ranking';
    }
    window.history.pushState({}, '', backUrl);
  }, [currentSection, selectedAnime]);

  // Anime selection
  const handleSelectAnime = useCallback((anime: AnimeItem) => {
    setSelectedAnime(anime);
    window.history.pushState({ animeId: anime.id }, '', `/anime/${anime.id}`);
  }, []);

  const handleSelectAnimeById = useCallback((animeId: number) => {
    const found = catalog.find((a) => a.id === animeId);
    if (found) {
      setSelectedAnime(found);
      window.history.pushState({ animeId }, '', `/anime/${animeId}`);
    } else {
      fetch(`/api/anime/${animeId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (json && json.data) {
            setSelectedAnime(json.data);
            window.history.pushState({ animeId }, '', `/anime/${animeId}`);
          }
        })
        .catch(() => {});
    }
  }, [catalog]);

  const handleCloseAnime = useCallback(() => {
    setSelectedAnime(null);
    let back = '/anime';
    if (currentSection === 'schedule') back = '/calendario';
    if (currentSection === 'ranking') back = '/ranking';
    window.history.pushState({}, '', back);
  }, [currentSection]);

  // Filtered news by search, source type, and category
  const filteredNews = useMemo(() => {
    return allNews.filter((item) => {
      // Source filter
      if (sourceFilter === 'radar' && !item.isRadarFlash) return false;
      if (sourceFilter === 'rss' && item.isRadarFlash) return false;

      // Category filter
      if (selectedCategory !== 'Todas') {
        if (item.category.toLowerCase() !== selectedCategory.toLowerCase()) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = item.title.toLowerCase().includes(q);
        const inSummary = item.summary.toLowerCase().includes(q);
        const inSource = item.sourceName.toLowerCase().includes(q);
        const inTags = item.tags.some((t) => t.toLowerCase().includes(q));
        if (!inTitle && !inSummary && !inSource && !inTags) return false;
      }

      return true;
    });
  }, [allNews, sourceFilter, selectedCategory, searchQuery]);

  const relatedModalArticles = useMemo(() => {
    if (!selectedArticle) return [];
    return allNews
      .filter((n) => n.id !== selectedArticle.id && n.category === selectedArticle.category)
      .slice(0, 3);
  }, [allNews, selectedArticle]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090c] text-zinc-950 dark:text-white font-sans transition-colors duration-150">
      {/* 1. Fixed Left Icon Rail (Shibuya Stream Architecture) */}
      <LeftIconRail
        currentSection={currentSection}
        onSectionChange={handleSectionChange}
        savedCount={savedItems.length}
        onOpenSaved={() => setIsSavedModalOpen(true)}
        isSyncing={isSyncing}
        onSync={() => fetchNews(true)}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        tokyoTime={tokyoTime}
      />

      {/* 2. Full-Bleed Main Viewport */}
      <div className="pl-16 w-full min-h-screen flex flex-col">
        <main className="flex-1 w-full">
          {currentSection === 'news' && (
            <MockupNewsLayout
              filteredNews={filteredNews}
              allNews={allNews}
              scheduleItems={scheduleItems}
              todayDay={todayDay}
              catalog={catalog}
              categories={CATEGORIES}
              selectedCategory={selectedCategory}
              isLoading={isLoading}
              onCategoryChange={(cat) => {
                setSelectedCategory(cat);
                setVisibleCount(22);
              }}
              sourceFilter={sourceFilter}
              onSourceFilterChange={(src) => {
                setSourceFilter(src);
                setVisibleCount(22);
              }}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              visibleCount={visibleCount}
              onLoadMore={() => setVisibleCount((prev) => prev + 18)}
              onSelectNews={handleSelectArticle}
              onSelectAnime={handleSelectAnime}
              onSelectAnimeById={handleSelectAnimeById}
              onSectionChange={handleSectionChange}
              isBookmarked={(kind, id) => isBookmarked(kind, id)}
              onToggleBookmark={(item) => handleToggleBookmark('news', item)}
            />
          )}

          {currentSection === 'catalog' && (
            <div className="max-w-[1400px] mx-auto px-6 py-8">
              <AnimeCatalog
                catalog={catalog}
                isLoading={catalogLoading}
                onSelectAnime={handleSelectAnime}
                isBookmarked={(_kind, id) => isBookmarked('anime', id)}
                onToggleBookmark={(anime) => handleToggleBookmark('anime', anime)}
              />
            </div>
          )}

          {currentSection === 'schedule' && (
            <div className="max-w-[1400px] mx-auto px-6 py-8">
              <ScheduleView
                scheduleItems={scheduleItems}
                todayDay={todayDay}
                isLoading={scheduleLoading}
                onSelectAnimeById={handleSelectAnimeById}
              />
            </div>
          )}

          {currentSection === 'ranking' && (
            <div className="max-w-[1400px] mx-auto px-6 py-8">
              <RankingView
                catalog={catalog}
                onSelectAnime={handleSelectAnime}
              />
            </div>
          )}
        </main>

      {/* 3. Article Reader Modal with Deep URL Linking */}
      <ArticleModal
        article={selectedArticle}
        onClose={handleCloseArticle}
        isBookmarked={selectedArticle ? isBookmarked('news', selectedArticle.id) : false}
        onToggleBookmark={(item) => handleToggleBookmark('news', item)}
        relatedArticles={relatedModalArticles}
        onSelectArticle={handleSelectArticle}
      />

      {/* 4. Anime Dossier Modal with Production Details & Linked Live Radar News */}
      <AnimeModal
        anime={selectedAnime}
        onClose={handleCloseAnime}
        onSelectNews={handleSelectArticle}
        isBookmarked={selectedAnime ? isBookmarked('anime', selectedAnime.id) : false}
        onToggleBookmark={(anime) => handleToggleBookmark('anime', anime)}
      />

      {/* 5. Saved Items (Bookmarks) Modal */}
      <SavedModal
        open={isSavedModalOpen}
        items={savedItems}
        onClose={() => setIsSavedModalOpen(false)}
        onSelectNews={(news) => {
          handleSelectArticle(news);
          setIsSavedModalOpen(false);
        }}
        onSelectAnime={(anime) => {
          handleSelectAnime(anime);
          setIsSavedModalOpen(false);
        }}
        onRemove={(entry) => handleToggleBookmark(entry.kind, entry.item as any)}
      />

      {/* 5. Minimal Adaptive Footer */}
      <footer className="mt-8 border-t py-6 px-6 lg:px-10 text-xs border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-jp font-bold text-zinc-900 dark:text-white">
              猫PRESS
            </span>
            <span>·</span>
            <span>Anime Intelligence & Streaming Wire</span>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-4 text-xs font-semibold">
            <button onClick={() => handleSectionChange('news')} className="hover:text-red-500 cursor-pointer">
              Despachos
            </button>
            <span>·</span>
            <button onClick={() => handleSectionChange('catalog')} className="hover:text-red-500 cursor-pointer">
              Catálogo
            </button>
            <span>·</span>
            <button onClick={() => handleSectionChange('schedule')} className="hover:text-red-500 cursor-pointer">
              Calendario JST
            </button>
            <span>·</span>
            <button onClick={() => handleSectionChange('ranking')} className="hover:text-red-500 cursor-pointer">
              Ranking
            </button>
          </div>

          <div className="text-xs font-mono opacity-70">
            <span>NekoPress v2.0 · Tokio 2026</span>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
};
