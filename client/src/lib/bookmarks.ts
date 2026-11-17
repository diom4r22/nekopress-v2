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

export function savedKey(kind: BookmarkKind, id: string): string {
  return `${kind}:${id}`;
}

export async function pushBookmark(item: SavedItem): Promise<void> {
  await fetch('/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: item.kind,
      itemId: item.id,
      payload: item.item,
      savedAt: item.savedAt,
    }),
  });
}

export async function removeBookmarkRemote(kind: BookmarkKind, id: string): Promise<void> {
  await fetch(`/api/bookmarks/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function pullBookmarks(): Promise<SavedItem[]> {
  const res = await fetch('/api/bookmarks');
  if (!res.ok) return [];
  const json = await res.json();
  if (!Array.isArray(json.data)) return [];

  const items: SavedItem[] = [];
  for (const row of json.data) {
    if (!row || (row.kind !== 'news' && row.kind !== 'anime') || !row.itemId || !row.payload) continue;
    items.push({
      kind: row.kind,
      id: String(row.itemId),
      savedAt: String(row.savedAt || new Date().toISOString()),
      item: row.payload,
    });
  }
  return items;
}
