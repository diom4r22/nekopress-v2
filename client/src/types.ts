export interface NewsItem {
  animeOverrideId?: number | null;
  featured?: { until: number; intro: string; image?: string };
  id: string;
  title: string;
  slug: string;
  summary: string;
  lead?: string;
  content?: string;
  url: string;
  sourceName: string;
  coverage?: { name: string; url: string; title: string }[];
  sourceUrl: string;
  author?: string;
  publishedAt: string;
  imageUrl?: string;
  category: string;
  tags: string[];
  language: 'es' | 'en' | 'ja';
  isVerified: boolean;
  isRadarFlash?: boolean;
  sourceType?: 'rss' | 'x_radar';
  twitterAuthorHandle?: string;
  curatedByAi?: boolean;
  verificationBadge?: 'verified_official' | 'leaker_scoop' | 'industry_report';
}

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  language: 'es' | 'en' | 'ja';
  lastFetchedAt?: string;
  lastSuccessAt?: string;
  itemCount: number;
  status: 'active' | 'error';
}

export interface AnimeItem {
  id: number;
  title: string;
  titleEnglish?: string;
  titleJapanese?: string;
  synopsis: string;
  imageUrl: string;
  format: 'TV' | 'Movie' | 'OVA' | 'ONA' | 'Special';
  episodes?: number;
  status: 'Finalizado' | 'En Emisión' | 'Próximamente';
  airing: boolean;
  score: number;
  rank?: number;
  popularity?: number;
  studios: string[];
  genres: string[];
  year?: number;
  season?: string;
}

export type DayOfWeek =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado'
  | 'domingo';

export interface ScheduleItem {
  id: string;
  animeId?: number;
  title: string;
  titleEnglish?: string;
  titleJapanese?: string;
  day: DayOfWeek;
  timeJST: string;
  airingAt?: number | null;
  timeUTC: string;
  platform: 'Crunchyroll' | 'Netflix' | 'Disney+' | 'Prime Video' | 'Anime Onegai' | 'Simulcast';
  platformUrl?: string;
  studio: string;
  currentEpisode?: number;
  imageUrl: string;
  synopsisPreview: string;
  genres: string[];
}

export interface StudioDossier {
  id: number;
  name: string;
  romajiName?: string;
  foundedYear: number;
  headquarters: string;
  keyFounders: string;
  philosophy: string;
  officialSite?: string;
  totalWorksCount: number;
  averageScore: number;
  masterpieces: AnimeItem[]; // Finalizados / Consagrados
  activeAndUpcoming: AnimeItem[]; // En Emisión / Próximamente
}

export interface StudioSummary {
  id: number;
  name: string;
  foundedYear: number;
  headquarters: string;
  keyFounders: string;
  philosophy: string;
  officialSite?: string;
  worksCount: number;
  averageScore: number;
  topTitles: string[];
}

