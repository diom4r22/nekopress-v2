import type { NewsCategory } from '../types.js';

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const ANIME = /\b(?:anime|animacion|animation|simulcast|episodio|episode|seiyuu)\b/;
const MUSIC_EVENT = /\b(?:conciertos?|concerts?|gira musical|concert tour)\b/;
const SUBJECTS: Array<[NewsCategory, RegExp]> = [
  ['Videojuegos', /\b(?:videojuegos?|video games?|nintendo switch|playstation|ps5|xbox|steam|game awards)\b/],
  ['Manga', /\b(?:mangas?|comics?|manhwas?|shonen jump|tankobon)\b/],
  ['Películas', /\b(?:peliculas?|films?|movies?|box office|taquilla)\b/],
  ['Streaming', /\b(?:streaming|crunchyroll|netflix|hidive|doblaje|simulcast)\b|disney\+/],
  ['Industria', /\b(?:estudio de animacion|animation studio|directiva|board of directors|adquisicion|acquisition)\b/],
  ['Anime', ANIME],
];

export function classifyNews(title: string, summary = '', fallback: NewsCategory = 'Anime'): NewsCategory {
  const headline = normalize(title);
  // The headline describes the story. The body often mentions several related media.
  if (/\b(?:anime adaptation|adaptacion (?:al|a) anime|tendra (?:un )?anime)\b/.test(headline)) return 'Anime';
  if (MUSIC_EVENT.test(headline) && !ANIME.test(normalize(`${title} ${summary}`))) return 'Industria';
  return SUBJECTS.find(([, pattern]) => pattern.test(headline))?.[0]
    ?? (fallback === 'Anime' ? SUBJECTS.find(([, pattern]) => pattern.test(normalize(summary)))?.[0] : undefined)
    ?? fallback;
}

export function hasRadarContext(text: string): boolean {
  const clean = text.replace(/https?:\/\/\S+|[@#]\S+/gi, ' ').trim();
  const words = clean.match(/[\p{L}\p{N}]+/gu) ?? [];
  const japanese = clean.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? [];
  return (words.length >= 5 || japanese.length >= 12)
    && !/^(?:the (?:good|bad) news is|la (?:buena|mala) noticia es|in my opinion|en mi opinion)\b/.test(normalize(clean))
    && !/(?:\.\.\.|…)$/.test(clean);
}
