import { AnimeItem, NewsItem } from '../types.js';

export type BookmarkKind = 'news' | 'anime';

export interface SavedNews {
  kind: 'news';
  id: string;
  savedAt: string;
  item: NewsItem;
}

export interface SavedAnime {
  kind: 'anime';
  id: string;
  savedAt: string;
  item: AnimeItem;
}

export type SavedItem = SavedNews | SavedAnime;

const STORAGE_KEY = 'nekopress.bookmarks.v1';

function isSavedItem(value: unknown): value is SavedItem {
  if (!value || typeof value !== 'object') return false;
  const row = value as SavedItem;
  return (row.kind === 'news' || row.kind === 'anime') && typeof row.id === 'string' && !!row.item;
}

function normalizeBookmarkImage<T extends SavedItem>(entry: T): T {
  const item = entry.item as any;
  if (item && typeof item.imageUrl === 'string' && (item.imageUrl.startsWith('http://') || item.imageUrl.startsWith('https://'))) {
    return {
      ...entry,
      item: {
        ...item,
        imageUrl: `/api/image-proxy?url=${encodeURIComponent(item.imageUrl)}`,
      },
    };
  }
  return entry;
}

export function readSaved(): SavedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedItem).map(normalizeBookmarkImage);
  } catch {
    return [];
  }
}

export function writeSaved(items: SavedItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
