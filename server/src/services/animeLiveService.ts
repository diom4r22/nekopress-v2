import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AnimeItem, ScheduleItem, DayOfWeek, StudioDossier, StudioSummary } from '../types.js';
import { CANONICAL_ANIME_CATALOG } from './animeCatalog.js';
import { CANONICAL_SCHEDULE } from './scheduleService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIVE_CACHE_PATH = path.resolve(__dirname, '..', '..', 'data', 'anilist-live-cache.json');

const GENRE_MAP: Record<string, string> = {
  Action: 'Acción',
  Adventure: 'Aventura',
  Comedy: 'Comedia',
  Drama: 'Drama',
  Ecchi: 'Ecchi',
  Fantasy: 'Fantasía',
  Horror: 'Terror',
  Mahou_Shoujo: 'Chicas Mágicas',
  Mecha: 'Mecha',
  Music: 'Música',
  Mystery: 'Misterio',
  Psychological: 'Psicológico',
  Romance: 'Romance',
  'Sci-Fi': 'Ciencia Ficción',
  'Slice of Life': 'Vida Cotidiana',
  Sports: 'Deportes',
  Supernatural: 'Sobrenatural',
  Thriller: 'Suspenso',
};

const DAY_NAMES_ES: DayOfWeek[] = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
];

const STUDIO_CANONICAL_MAP: Record<string, string> = {
  madhouse: 'Madhouse',
  bones: 'Bones',
  'wit studio': 'Wit Studio',
  'white fox': 'White Fox',
  'toei animation': 'Toei Animation',
  'science saru': 'Science SARU',
  mappa: 'MAPPA',
  cloverworks: 'CloverWorks',
  ufotable: 'ufotable',
  'a-1 pictures': 'A-1 Pictures',
  'production i.g': 'Production I.G',
  'kyoto animation': 'Kyoto Animation',
  pierrot: 'Pierrot',
  'studio pierrot': 'Pierrot',
  'doga kobo': 'Doga Kobo',
  shaft: 'Shaft',
  sunrise: 'Sunrise',
  'bandai namco pictures': 'Bandai Namco Pictures',
  'tms entertainment': 'TMS Entertainment',
};

export interface StudioDef {
  id: number;
  name: string;
  romajiName: string;
  foundedYear: number;
  headquarters: string;
  keyFounders: string;
  philosophy: string;
  officialSite: string;
}

export const STUDIO_DEFINITIONS: StudioDef[] = [
  {
    id: 569,
    name: 'MAPPA',
    romajiName: 'Kabushiki-gaisha MAPPA',
    foundedYear: 2011,
    headquarters: 'Suginami, Tokio, Japón',
    keyFounders: 'Masao Maruyama & Manabu Otsuka',
    philosophy: 'Producción de animación sin límites creativos, secuencias de acción coreografiadas hiperdinámicas y ambiciosas adaptaciones cinematográficas.',
    officialSite: 'http://www.mappa.co.jp',
  },
  {
    id: 43,
    name: 'ufotable',
    romajiName: 'Yūfōtēburu Kabushiki-gaisha',
    foundedYear: 2000,
    headquarters: 'Suginami, Tokio, Japón',
    keyFounders: 'Hikaru Kondo (Fundador & Productor)',
    philosophy: 'Integración visual perfecta entre 2D y 3D CGI digital, iluminación volumétrica fotográfica y fidelidad cinematográfica insuperable.',
    officialSite: 'http://www.ufotable.com',
  },
  {
    id: 4,
    name: 'Bones',
    romajiName: 'Kabushiki-gaisha Bonzu',
    foundedYear: 1998,
    headquarters: 'Suginami, Tokio, Japón',
    keyFounders: 'Masahiko Minami, Hiroshi Oosaka & Toshihiro Kawamoto (ex-Sunrise)',
    philosophy: '"Animación con Hueso": fluidez acrobática dibujada a mano cuadro a cuadro, peso cinético y narrativas profundas.',
    officialSite: 'https://www.bones.co.jp',
  },
  {
    id: 11,
    name: 'Madhouse',
    romajiName: 'Kabushiki-gaisha Maddohausu',
    foundedYear: 1972,
    headquarters: 'Nakano, Tokio, Japón',
    keyFounders: 'Masao Maruyama, Osamu Dezaki, Rintaro & Yoshiaki Kawajiri',
    philosophy: 'Pioneros del anime moderno: obras psicológicas de culto, thrillers oscuros magistrales y adaptaciones canónicas universales.',
    officialSite: 'https://www.madhouse.co.jp',
  },
  {
    id: 858,
    name: 'Wit Studio',
    romajiName: 'Kabushiki-gaisha Witto Sutajio',
    foundedYear: 2012,
    headquarters: 'Musashino, Tokio, Japón',
    keyFounders: 'George Wada & Tetsuya Nakatake (ex-Production I.G)',
    philosophy: 'Dinamismo vertical, animación aérea visceral, fondos hiperdetallados pintados al óleo y adaptaciones de impacto cultural global.',
    officialSite: 'https://www.witstudio.co.jp',
  },
  {
    id: 6222,
    name: 'CloverWorks',
    romajiName: 'Kabushiki-gaisha Kurōbāwākusu',
    foundedYear: 2018,
    headquarters: 'Suginami, Tokio, Japón',
    keyFounders: 'Akira Shimizu (ex-A-1 Pictures Koenji Studio)',
    philosophy: 'Sensibilidad pop moderna, diseño de personajes expresivo de máxima calidad y narrativas generacionales que definen la cultura juvenil.',
    officialSite: 'https://cloverworks.co.jp',
  },
  {
    id: 18,
    name: 'Toei Animation',
    romajiName: 'Tōei Animēshon Kabushiki-gaisha',
    foundedYear: 1948,
    headquarters: 'Nerima, Tokio, Japón',
    keyFounders: 'Kenzō Masaoka & Zenjirō Yamamoto',
    philosophy: 'El templo histórico del anime japonés: creadores de las franquicias más colosales, legendarias y queridas de la historia de la humanidad.',
    officialSite: 'https://www.toei-anim.co.jp',
  },
  {
    id: 6145,
    name: 'Science SARU',
    romajiName: 'Kabushiki-gaisha Saiensu SARU',
    foundedYear: 2013,
    headquarters: 'Kichijoji, Tokio, Japón',
    keyFounders: 'Masaaki Yuasa & Eunyoung Choi',
    philosophy: 'Vanguardismo artístico experimental, animación digital de ultra elasticidad, ritmo psicodélico y libertad autoral pura.',
    officialSite: 'https://www.sciencesaru.com',
  },
  {
    id: 10,
    name: 'Production I.G',
    romajiName: 'Kabushiki-gaisha Purodakushon Ai Jī',
    foundedYear: 1987,
    headquarters: 'Musashino, Tokio, Japón',
    keyFounders: 'Mitsuhisa Ishikawa & Takayuki Goto',
    philosophy: 'Excelencia técnica militar y ciberpunk, animación de deportes de precisión atómica y madurez temática reconocida a nivel mundial.',
    officialSite: 'https://www.production-ig.co.jp',
  },
  {
    id: 314,
    name: 'White Fox',
    romajiName: 'Kabushiki-gaisha Howaito Fokkusu',
    foundedYear: 2007,
    headquarters: 'Suginami, Tokio, Japón',
    keyFounders: 'Gaku Iwasa (ex-OLM Team Iwasa)',
    philosophy: 'Compromiso implacable con la adaptación rigurosa de novelas visuales complejas, tensión psicológica extrema y episodios sin recortes comerciales.',
    officialSite: 'http://whitefox.info',
  },
];

function normalizeStudio(rawName?: string): string {
  if (!rawName) return 'Estudio Oficial';
  const cleaned = rawName.trim();
  return STUDIO_CANONICAL_MAP[cleaned.toLowerCase()] || cleaned;
}

function cleanHtml(text?: string): string {
  if (!text) return 'Sin descripción disponible.';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function fetchAniList(query: string, variables: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query, variables });
    const req = https.request(
      'https://graphql.anilist.co',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'NekoPress-Intelligence/2.0 (Live News & Anime Wire)',
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.errors) {
              reject(new Error(json.errors[0]?.message || 'AniList GraphQL Error'));
            } else {
              resolve(json.data);
            }
          } catch (e) {
            reject(new Error('Error al parsear respuesta JSON de AniList'));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout al consultar AniList API'));
    });

    req.write(postData);
    req.end();
  });
}

export class AnimeLiveService {
  private catalog: AnimeItem[] = [...CANONICAL_ANIME_CATALOG];
  private schedule: ScheduleItem[] = [...CANONICAL_SCHEDULE];
  private studioDossiers: Map<string, StudioDossier> = new Map();
  private lastSyncAt: string | null = null;
  private syncPromise: Promise<{ catalogCount: number; scheduleCount: number; studioCount: number }> | null = null;

  constructor() {
    this.loadLiveCache();
    this.buildInitialDossiers();
    this.bootSync();
  }

  private loadLiveCache(): void {
    try {
      if (fs.existsSync(LIVE_CACHE_PATH)) {
        const raw = fs.readFileSync(LIVE_CACHE_PATH, 'utf8');
        const parsed = JSON.parse(raw) as {
          catalog?: AnimeItem[];
          schedule?: ScheduleItem[];
          lastSyncAt?: string;
        };
        if (Array.isArray(parsed.catalog) && parsed.catalog.length > 0) {
          this.catalog = parsed.catalog;
        }
        if (Array.isArray(parsed.schedule) && parsed.schedule.length > 0) {
          this.schedule = parsed.schedule;
        }
        if (parsed.lastSyncAt) {
          this.lastSyncAt = parsed.lastSyncAt;
        }
      }
    } catch {
      // Silencioso: se reconstruye en bootSync
    }
  }

  private saveLiveCache(): void {
    try {
      fs.mkdirSync(path.dirname(LIVE_CACHE_PATH), { recursive: true });
      const temp = LIVE_CACHE_PATH + '.tmp';
      fs.writeFileSync(
        temp,
        JSON.stringify({
          catalog: this.catalog,
          schedule: this.schedule,
          lastSyncAt: this.lastSyncAt,
        }),
        'utf8'
      );
      fs.renameSync(temp, LIVE_CACHE_PATH);
    } catch {
      // Silencioso
    }
  }

  /**
   * AniList puede agotar el tiempo o devolver 429 en el primer arranque.
   * Sin reintento el catálogo se queda en las 25 fichas locales y el calendario en cero.
   * Si la red sigue caída, permanece el calendario canónico ya cargado.
   */
  private bootSync(attempt = 1): void {
    this.sync()
      .then((result) => {
        const thinCatalog = result.catalogCount < 200;
        const emptySchedule = result.scheduleCount === 0;
        if ((thinCatalog || emptySchedule) && attempt < 4) {
          const waitMs = attempt * 5000;
          console.warn(
            `[AnimeLiveService] Catálogo=${result.catalogCount}, calendario=${result.scheduleCount}. Reintento ${attempt}/3 en ${waitMs}ms.`
          );
          setTimeout(() => this.bootSync(attempt + 1), waitMs);
        }
      })
      .catch((err) => {
        console.warn('Advertencia en carga inicial de AnimeLiveService:', (err as Error).message);
        if (attempt < 4) {
          setTimeout(() => this.bootSync(attempt + 1), attempt * 5000);
        }
      });
  }

  private buildInitialDossiers() {
    for (const def of STUDIO_DEFINITIONS) {
      const studioItems = this.catalog.filter((a) =>
        a.studios.some((s) => s.toLowerCase().includes(def.name.toLowerCase()))
      );
      const masterpieces = studioItems
        .filter((i) => i.status === 'Finalizado')
        .sort((a, b) => b.score - a.score);
      const activeAndUpcoming = studioItems.filter(
        (i) => i.status === 'En Emisión' || i.status === 'Próximamente'
      );
      const avgScore =
        studioItems.length > 0
          ? Number(
              (studioItems.reduce((acc, i) => acc + i.score, 0) / studioItems.length).toFixed(2)
            )
          : 8.5;

      this.studioDossiers.set(def.name.toLowerCase(), {
        id: def.id,
        name: def.name,
        romajiName: def.romajiName,
        foundedYear: def.foundedYear,
        headquarters: def.headquarters,
        keyFounders: def.keyFounders,
        philosophy: def.philosophy,
        officialSite: def.officialSite,
        totalWorksCount: studioItems.length,
        averageScore: avgScore,
        masterpieces,
        activeAndUpcoming,
      });
    }
  }

  public sync(): Promise<{ catalogCount: number; scheduleCount: number; studioCount: number }> {
    if (this.syncPromise) {
      return this.syncPromise;
    }
    this.syncPromise = this.executeSync().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  private async executeSync(): Promise<{ catalogCount: number; scheduleCount: number; studioCount: number }> {
    try {
      // 1. Query Top Releasing (Strictly currently broadcasting anime)
      const releasingQuery = `
        query {
          Page(page: 1, perPage: 30) {
            media(status: RELEASING, type: ANIME, sort: POPULARITY_DESC) {
              id
              idMal
              title { romaji english native }
              format
              episodes
              status
              averageScore
              popularity
              studios(isMain: true) { nodes { name } }
              genres
              description
              coverImage { extraLarge }
              nextAiringEpisode { episode airingAt timeUntilAiring }
              startDate { year month day }
            }
          }
        }
      `;

      // 2. Query Top Rated All Time (Masterworks históricos)
      const topQuery = `
        query {
          Page(page: 1, perPage: 25) {
            media(type: ANIME, sort: SCORE_DESC) {
              id
              idMal
              title { romaji english native }
              format
              episodes
              status
              averageScore
              popularity
              studios(isMain: true) { nodes { name } }
              genres
              description
              coverImage { extraLarge }
              startDate { year month day }
            }
          }
        }
      `;

      // 3. Query Studio Media Template
      const studioMediaQuery = `
        query ($studioId: Int) {
          Studio(id: $studioId) {
            id
            name
            media(sort: [POPULARITY_DESC, SCORE_DESC], perPage: 25) {
              nodes {
                id
                idMal
                title { romaji english native }
                format
                episodes
                status
                averageScore
                popularity
                seasonYear
                genres
                description
                coverImage { extraLarge large }
              }
            }
          }
        }
      `;

      // Fetch Releasing & Top masterworks in parallel
      const [releasingData, topData] = await Promise.all([
        fetchAniList(releasingQuery).catch(() => null),
        fetchAniList(topQuery).catch(() => null),
      ]);

      // Fetch all 10 studio filmographies with slight pacing to prevent AniList 429 rate limits
      const studioResults: { def: StudioDef; data: any }[] = [];
      for (const def of STUDIO_DEFINITIONS) {
        try {
          const data = await fetchAniList(studioMediaQuery, { studioId: def.id });
          studioResults.push({ def, data });
          await new Promise((r) => setTimeout(r, 150));
        } catch {
          studioResults.push({ def, data: null });
        }
      }

      const rawReleasing = releasingData?.Page?.media || [];
      const rawTop = topData?.Page?.media || [];

      // Preserve previously translated Spanish synopses from current catalog & schedule
      const prevCatalogMap = new Map<number, AnimeItem>();
      for (const item of this.catalog) {
        prevCatalogMap.set(item.id, item);
      }
      const prevScheduleMap = new Map<string, ScheduleItem>();
      for (const s of this.schedule) {
        prevScheduleMap.set(s.id, s);
      }

      // Seed catalogMap with verified canonical catalog first
      const catalogMap = new Map<number, AnimeItem>();
      for (const item of CANONICAL_ANIME_CATALOG) {
        catalogMap.set(item.id, { ...item });
      }

      const newSchedule: ScheduleItem[] = [];

      // Process Releasing Anime into Schedule & Catalog
      for (const m of rawReleasing) {
        const id = m.idMal || m.id;
        const studio = normalizeStudio(m.studios?.nodes?.[0]?.name);
        const score = m.averageScore ? Number((m.averageScore / 10).toFixed(2)) : 8.0;

        let day: DayOfWeek = 'lunes';
        let timeJST = '23:00 JST';
        let currentEpisode = m.nextAiringEpisode ? m.nextAiringEpisode.episode : 1;

        if (m.nextAiringEpisode?.airingAt) {
          const date = new Date(m.nextAiringEpisode.airingAt * 1000);
          const tokyoStr = date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
          const tokyoDate = new Date(tokyoStr);
          day = DAY_NAMES_ES[tokyoDate.getDay()] || 'lunes';

          const hours = String(tokyoDate.getHours()).padStart(2, '0');
          const minutes = String(tokyoDate.getMinutes()).padStart(2, '0');
          timeJST = `${hours}:${minutes} JST`;
        } else if (m.startDate?.year) {
          const d = new Date(m.startDate.year, (m.startDate.month || 1) - 1, m.startDate.day || 1);
          day = DAY_NAMES_ES[d.getDay()] || 'domingo';
        }

        let platform: ScheduleItem['platform'] = 'Crunchyroll';
        let platformUrl = 'https://www.crunchyroll.com';
        const titleLower = (m.title.romaji + ' ' + (m.title.english || '')).toLowerCase();
        if (
          titleLower.includes('ranma') ||
          titleLower.includes('blue box') ||
          titleLower.includes('ao no hako') ||
          titleLower.includes('orb:') ||
          titleLower.includes('chikyuu')
        ) {
          platform = 'Netflix';
          platformUrl = 'https://www.netflix.com';
        } else if (titleLower.includes('bleach') || titleLower.includes('disney')) {
          platform = 'Disney+';
          platformUrl = 'https://www.disneyplus.com';
        }

        const prevSched = prevScheduleMap.get(`live-${m.id}`);
        const prevCat = prevCatalogMap.get(id);

        const scheduleItem: ScheduleItem = {
          id: `live-${m.id}`,
          animeId: id,
          title: m.title.english || m.title.romaji,
          titleEnglish: m.title.english || m.title.romaji,
          titleJapanese: m.title.native,
          day,
          timeJST,
          timeUTC: 'Simulcast Global',
          platform,
          platformUrl,
          studio,
          currentEpisode,
          imageUrl: m.coverImage?.extraLarge || m.coverImage?.large || '',
          synopsisPreview: prevSched?.synopsisPreview || cleanHtml(m.description).slice(0, 160) + '...',
          genres: (m.genres || []).map((g: string) => GENRE_MAP[g] || g),
        };
        newSchedule.push(scheduleItem);

        const existing = catalogMap.get(id);
        if (existing) {
          if (existing.status !== 'Finalizado') {
            existing.status = 'En Emisión';
            existing.airing = true;
          }
        } else {
          catalogMap.set(id, {
            id,
            title: m.title.english || m.title.romaji,
            titleEnglish: m.title.english,
            titleJapanese: m.title.native,
            synopsis: prevCat?.synopsis || cleanHtml(m.description),
            imageUrl: m.coverImage?.extraLarge,
            format: m.format === 'MOVIE' ? 'Movie' : 'TV',
            episodes: m.episodes || undefined,
            status: 'En Emisión',
            airing: true,
            score,
            popularity: m.popularity,
            studios: [studio],
            genres: (m.genres || []).map((g: string) => GENRE_MAP[g] || g),
            year: m.startDate?.year || 2026,
          });
        }
      }

      // Add Top All-Time Masterworks
      for (const m of rawTop) {
        const id = m.idMal || m.id;
        if (!catalogMap.has(id)) {
          const prevCat = prevCatalogMap.get(id);
          const studio = normalizeStudio(m.studios?.nodes?.[0]?.name);
          const score = m.averageScore ? Number((m.averageScore / 10).toFixed(2)) : 9.0;
          const isAiring = m.status === 'RELEASING';

          catalogMap.set(id, {
            id,
            title: m.title.english || m.title.romaji,
            titleEnglish: m.title.english,
            titleJapanese: m.title.native,
            synopsis: prevCat?.synopsis || cleanHtml(m.description),
            imageUrl: m.coverImage?.extraLarge,
            format: m.format === 'MOVIE' ? 'Movie' : 'TV',
            episodes: m.episodes || undefined,
            status: isAiring ? 'En Emisión' : 'Finalizado',
            airing: isAiring,
            score,
            popularity: m.popularity,
            studios: [studio],
            genres: (m.genres || []).map((g: string) => GENRE_MAP[g] || g),
            year: m.startDate?.year,
          });
        }
      }

      // Process Studio Filmographies for all 10 Studios
      const newDossiers = new Map<string, StudioDossier>();

      for (const res of studioResults) {
        const def = res.def;
        const nodes = res.data?.Studio?.media?.nodes || [];
        const studioItems: AnimeItem[] = [];
        const seenTitles = new Set<string>();

        for (const m of nodes) {
          const title = m.title.english || m.title.romaji;
          const key = title.toLowerCase().trim();
          if (seenTitles.has(key)) continue;
          seenTitles.add(key);

          const id = m.idMal || m.id;
          const score = m.averageScore ? Number((m.averageScore / 10).toFixed(2)) : 8.2;
          const isAiring = m.status === 'RELEASING';
          const isUpcoming = m.status === 'NOT_YET_RELEASED';
          const status = isAiring ? 'En Emisión' : isUpcoming ? 'Próximamente' : 'Finalizado';

          // Prioritize canonical catalog metadata when already verified
          const canon = catalogMap.get(id);
          const finalScore = canon ? canon.score : score;
          const finalStatus = canon ? canon.status : status;
          const finalAiring = canon ? canon.airing : isAiring;
          const finalTitle = canon ? canon.title : title;
          const finalFormat = canon ? canon.format : (m.format === 'MOVIE' ? 'Movie' : 'TV');

          const item: AnimeItem = {
            id,
            title: finalTitle,
            titleEnglish: canon?.titleEnglish || m.title.english,
            titleJapanese: canon?.titleJapanese || m.title.native,
            synopsis: canon?.synopsis || prevCatalogMap.get(id)?.synopsis || cleanHtml(m.description),
            imageUrl: canon?.imageUrl || m.coverImage?.extraLarge || m.coverImage?.large,
            format: finalFormat,
            episodes: canon?.episodes || m.episodes || undefined,
            status: finalStatus,
            airing: finalAiring,
            score: finalScore,
            popularity: canon?.popularity ?? m.popularity,
            studios: canon ? Array.from(new Set([...canon.studios, def.name])) : [def.name],
            genres: canon ? canon.genres : (m.genres || []).map((g: string) => GENRE_MAP[g] || g),
            year: canon?.year || m.seasonYear,
          };

          studioItems.push(item);

          // If not in main catalog, add it so the studio filter displays it!
          if (!catalogMap.has(id)) {
            catalogMap.set(id, item);
          } else {
            // Ensure studio name is recorded in studios array
            const existing = catalogMap.get(id)!;
            if (!existing.studios.includes(def.name)) {
              existing.studios.push(def.name);
            }
          }
        }

        // Resilient Fallback: If network failed or AniList rate-limited, ensure known canonical works are preserved
        if (studioItems.length === 0) {
          const canonicalWorks = Array.from(catalogMap.values()).filter((a) =>
            a.studios.some((s) => s.toLowerCase().includes(def.name.toLowerCase()))
          );
          studioItems.push(...canonicalWorks);
        }

        const masterpieces = studioItems
          .filter((i) => i.status === 'Finalizado')
          .sort((a, b) => b.score - a.score);

        const activeAndUpcoming = studioItems.filter(
          (i) => i.status === 'En Emisión' || i.status === 'Próximamente'
        );

        const avgScore =
          studioItems.length > 0
            ? Number(
                (studioItems.reduce((acc, i) => acc + i.score, 0) / studioItems.length).toFixed(2)
              )
            : 8.5;

        const dossier: StudioDossier = {
          id: def.id,
          name: def.name,
          romajiName: def.romajiName,
          foundedYear: def.foundedYear,
          headquarters: def.headquarters,
          keyFounders: def.keyFounders,
          philosophy: def.philosophy,
          officialSite: def.officialSite,
          totalWorksCount: studioItems.length,
          averageScore: avgScore,
          masterpieces,
          activeAndUpcoming,
        };

        newDossiers.set(def.name.toLowerCase(), dossier);
      }

      this.studioDossiers = newDossiers;
      this.catalog = Array.from(catalogMap.values());
      if (newSchedule.length > 0) {
        this.schedule = newSchedule;
      }
      this.lastSyncAt = new Date().toISOString();
      this.saveLiveCache();

      console.log(
        `✓ [AnimeLiveService] Sincronización exitosa: ${this.catalog.length} producciones en catálogo canónico, ${this.studioDossiers.size} estudios con filmografía completa, ${this.schedule.length} en calendario semanal.`
      );

      return {
        catalogCount: this.catalog.length,
        scheduleCount: this.schedule.length,
        studioCount: this.studioDossiers.size,
      };
    } catch (err) {
      console.error('Error al sincronizar datos en vivo de AniList:', (err as Error).message);
      return {
        catalogCount: this.catalog.length,
        scheduleCount: this.schedule.length,
        studioCount: this.studioDossiers.size,
      };
    }
  }

  public getStudios(): StudioSummary[] {
    const list: StudioSummary[] = [];
    for (const def of STUDIO_DEFINITIONS) {
      const dossier = this.studioDossiers.get(def.name.toLowerCase());
      list.push({
        id: def.id,
        name: def.name,
        foundedYear: def.foundedYear,
        headquarters: def.headquarters,
        keyFounders: def.keyFounders,
        philosophy: def.philosophy,
        officialSite: def.officialSite,
        worksCount: dossier ? dossier.totalWorksCount : 0,
        averageScore: dossier ? dossier.averageScore : 8.5,
        topTitles: dossier
          ? dossier.masterpieces.slice(0, 4).map((m) => m.title)
          : [],
      });
    }
    return list;
  }

  public getStudioDossier(name: string): StudioDossier | undefined {
    const clean = name.toLowerCase().trim();
    return this.studioDossiers.get(clean);
  }

  public getCatalog(filter?: {
    format?: string;
    studio?: string;
    status?: string;
    search?: string;
    sort?: string;
  }): AnimeItem[] {
    let list = [...this.catalog];

    if (!filter) return list;

    if (filter.format && filter.format !== 'all') {
      list = list.filter((a) => a.format.toLowerCase() === filter.format!.toLowerCase());
    }

    if (filter.studio && filter.studio !== 'all' && filter.studio !== 'todos') {
      const q = filter.studio.toLowerCase();
      list = list.filter((a) => a.studios.some((s) => s.toLowerCase().includes(q)));
    }

    if (filter.status && filter.status !== 'all') {
      const st = filter.status.toLowerCase();
      if (st === 'airing' || st === 'emision' || st === 'en emisión') {
        list = list.filter((a) => a.airing && a.status === 'En Emisión');
      } else if (st === 'finished' || st === 'finalizado') {
        list = list.filter((a) => !a.airing && a.status === 'Finalizado');
      } else {
        list = list.filter((a) => a.status.toLowerCase() === st);
      }
    }

    if (filter.search) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter((a) => {
        const inTitle = a.title.toLowerCase().includes(q);
        const inEng = (a.titleEnglish || '').toLowerCase().includes(q);
        const inJp = (a.titleJapanese || '').toLowerCase().includes(q);
        const inStudio = a.studios.some((s) => s.toLowerCase().includes(q));
        const inGenre = a.genres.some((g) => g.toLowerCase().includes(q));
        return inTitle || inEng || inJp || inStudio || inGenre;
      });
    }

    if (filter.sort === 'score') {
      list.sort((a, b) => b.score - a.score);
    } else if (filter.sort === 'popularity') {
      list.sort((a, b) => {
        const popA = a.popularity ?? 9999;
        const popB = b.popularity ?? 9999;
        if (popA > 1000 || popB > 1000) return popB - popA;
        return popA - popB;
      });
    } else if (filter.sort === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }

  public getAnimeById(id: number): AnimeItem | undefined {
    return this.catalog.find((a) => a.id === id);
  }

  public getSchedule(day?: string, platform?: string): ScheduleItem[] {
    let result = [...this.schedule];

    if (day && day !== 'all' && day !== 'todos') {
      result = result.filter((item) => item.day.toLowerCase() === day.toLowerCase());
    }

    if (platform && platform !== 'all' && platform !== 'todos') {
      result = result.filter((item) => item.platform.toLowerCase() === platform.toLowerCase());
    }

    return result;
  }

  public getRanking(category = 'all'): {
    data: (AnimeItem & { rankPosition: number })[];
    stats: { total: number; category: string; avgScore: string };
  } {
    let list = [...this.catalog];

    if (category === 'airing') {
      // 1. TOP EN EMISIÓN: ONLY currently airing shows, zero finished shows
      list = list.filter((a) => a.airing && a.status === 'En Emisión');
      list.sort((a, b) => b.score - a.score);
    } else if (category === 'movies') {
      // 2. TOP PELÍCULAS: ONLY Movie format
      list = list.filter((a) => a.format === 'Movie');
      list.sort((a, b) => b.score - a.score);
    } else if (category === 'popular') {
      // 3. TOP MÁS POPULARES: sorted strictly by popularity rank
      list.sort((a, b) => {
        const popA = a.popularity ?? 9999;
        const popB = b.popularity ?? 9999;
        if (popA > 1000 || popB > 1000) return popB - popA;
        return popA - popB;
      });
    } else {
      // 4. TOP CRÍTICA HISTÓRICA: ONLY finished masterworks, zero currently airing anime
      list = list.filter((a) => !a.airing && a.status === 'Finalizado');
      list.sort((a, b) => b.score - a.score);
    }

    const itemsWithRank = list.map((item, index) => ({
      ...item,
      rankPosition: index + 1,
    }));

    const avgScore =
      itemsWithRank.length > 0
        ? (
            itemsWithRank.reduce((sum, item) => sum + item.score, 0) / itemsWithRank.length
          ).toFixed(2)
        : '0.00';

    return {
      data: itemsWithRank,
      stats: {
        total: itemsWithRank.length,
        category,
        avgScore,
      },
    };
  }

  public getDaySummary(): Record<string, number> {
    const summary: Record<string, number> = {
      lunes: 0,
      martes: 0,
      miercoles: 0,
      jueves: 0,
      viernes: 0,
      sabado: 0,
      domingo: 0,
      total: this.schedule.length,
    };

    this.schedule.forEach((item) => {
      if (summary[item.day] !== undefined) {
        summary[item.day]++;
      }
    });

    return summary;
  }

  public getTodayDayName(timeZone = 'Asia/Tokyo'): DayOfWeek {
    try {
      const now = new Date();
      const localDate = new Date(now.toLocaleString('en-US', { timeZone }));
      return DAY_NAMES_ES[localDate.getDay()] || 'lunes';
    } catch {
      const day = new Date().getDay();
      return DAY_NAMES_ES[day] || 'lunes';
    }
  }
}

export const animeLiveService = new AnimeLiveService();
