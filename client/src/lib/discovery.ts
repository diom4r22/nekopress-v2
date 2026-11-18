import type { AnimeItem, NewsItem } from '../types.js';
import { headline, videoId } from './story.js';

export function searchable(value: string) {
  return value.normalize('NFKD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function titles(item: Pick<AnimeItem, 'title' | 'titleEnglish' | 'titleJapanese'>) {
  return [item.title, item.titleEnglish, item.titleJapanese].filter((title): title is string => !!title);
}

export function trailerLookup(catalog: AnimeItem[]) {
  const byId = new Map(catalog.map(item => [item.id, item]));
  const aliases = new Map<string, Set<AnimeItem>>();
  for (const anime of catalog) {
    for (const name of titles(anime)) {
      const key = searchable(name);
      if (!key) continue;
      if (!aliases.has(key)) aliases.set(key, new Set());
      aliases.get(key)!.add(anime);
    }
  }
  return (article: NewsItem) => {
    if (!videoId(article.url)) return undefined;
    if (article.animeOverrideId != null) return byId.get(article.animeOverrideId);
    // Only accept an entire title next to a video descriptor. Keep season numbers and subtitles.
    const name = headline(article.title)
      .replace(/\s*[-–—|:【(\[]*\s*(?:(?:official|oficial|main|nuevo|new)\s+)*(?:tr[aá]iler|teaser|promocional|PV)\b(?:\s+(?:oficial|principal|final))?(?:\s*[#｜|\d)\]】].*)?\s*$/iu, '')
      .replace(/^(?:tr[aá]iler|teaser)\s+(?:oficial\s+)?(?:de\s+)?/iu, '');
    const hits = aliases.get(searchable(name));
    return hits?.size === 1 ? hits.values().next().value : undefined;
  };
}
