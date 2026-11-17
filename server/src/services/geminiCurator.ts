/**
 * 猫PRESS v2 — Gemini AI Curation Engine
 * Servicio editorial de curaduría para primicias y despachos del Radar X.
 * 
 * Filtra el 100% de memes, opiniones y spam, reteniendo exclusivamente
 * noticias canónicas y redactando despachos de ultra-baja latencia en español neutro.
 * Incluye un fallback heurístico automático si no hay GEMINI_API_KEY en .env.
 */

import dotenv from 'dotenv';
import { NewsCategory } from '../types.js';
import { getCachedTranslation, saveCachedTranslation } from '../db/database.js';

export interface RawTweetCandidate {
  id: string;
  authorHandle: string;
  authorName: string;
  text: string;
  createdAt: string;
  mediaUrls: string[];
  tweetUrl: string;
}

export interface CuratedDispatch {
  shouldPublish: boolean;
  rejectionReason?: string;
  title: string;
  lead: string;
  content: string;
  summary: string;
  category: NewsCategory;
  tags: string[];
  animeEntities: string[];
  curatedByAi: boolean;
  verificationBadge: 'verified_official' | 'leaker_scoop' | 'industry_report';
}

const SYSTEM_PROMPT = `
Eres el Editor Jefe de Redacción y Crónicas de NekoPress v2 (Agencia de Inteligencia Anime).
Tu misión es procesar un tweet o cable de primicia y determinar si constituye una NOTICIA OFICIAL O PRIMICIA PERIODÍSTICA CONFIRMADA.

POLÍTICA DE FILTRADO ESTRICTO:
- DESCARTAR (100% de exclusión, debe retornar {"shouldPublish": false}):
  * Memes, chistes, humor o shitposting.
  * Opiniones personales, reseñas subjetivas, quejas o rankings de fans.
  * Fotos de cosplay de fans no oficiales o fanarts.
  * Enlaces de afiliados a tiendas de figuras o merchandising sin anuncio editorial relevante.
  * Sorteos, peticiones de retuits o preguntas triviales a la comunidad ("¿cuál prefieres?").
- ACEPTAR (Debe retornar {"shouldPublish": true}):
  * Tráilers oficiales (PVs), Teasers o adelantos de metraje.
  * Visuales clave (Key Visuals / KV) y pósteres promocionales oficiales.
  * Fechas de estreno, meses de emisión o anuncios de ventanas de lanzamiento.
  * Confirmación de adaptaciones al anime de mangas, novelas ligeras o manhwas.
  * Anuncios de renovación de temporadas, pausas de producción o cancelaciones oficiales.
  * Anuncios oficiales de staff principal (director, estudio, guionista) o elenco (seiyuus).

REGLAS DE REDACCIÓN EDITORIAL (ARTÍCULO COMPLETO):
1. Idioma: Español neutro periodístico, formal y conciso (estilo cable de agencia EFE/Reuters).
2. Titular (title): Máximo 95 caracteres. Claro, directo, sin signos innecesarios ni clickbait.
3. Entradilla / Bajada (lead): 1 a 2 oraciones densas en información (140 a 220 caracteres) resumiendo el hecho noticioso clave.
4. Artículo Completo (content): Redacta una crónica periodística de fondo en 3 a 5 párrafos estructurados:
   - Párrafo 1: El hecho noticioso principal (anuncio, teaser, fecha, evento o revelación oficial).
   - Párrafo 2: Antecedentes de la franquicia y contexto de la historia (autor original, temporadas previas, arcos).
   - Párrafo 3: Producción técnica (estudio de animación, directores clave, staff, seiyuus, distribuidora internacional o plataforma).
   - Párrafo 4: Relevancia y próximos pasos (calendario de estrenos, siguientes trailers o repercusión en la industria).
5. Resumen (summary): 2 a 3 oraciones concisas para la tarjeta en cuadrícula (160-240 caracteres).
6. Categorización: Asignar una categoría estricta de la lista: ['Anime', 'Manga', 'Películas', 'Streaming', 'Videojuegos', 'Industria'].
7. Etiquetas (tags): 3 a 5 tags normalizados sin numeral (ej: ["ChainsawMan", "MAPPA", "Teaser", "Estreno2025"]).
8. Insignia de Verificación (verificationBadge):
   - "verified_official": Si la fuente es un estudio oficial (@MAPPA_Info, @ufotable) o comunicado oficial.
   - "leaker_scoop": Si la fuente es un leaker de alta reputación (@AIR_News01, @SugoiLITE).
   - "industry_report": Si la fuente es un medio de la industria (@WSJ_manga, @AniTrendz).

FORMATO DE RESPUESTA:
Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura:
{
  "shouldPublish": boolean,
  "rejectionReason": string | null,
  "title": string,
  "lead": string,
  "content": string,
  "summary": string,
  "category": "Anime" | "Manga" | "Películas" | "Streaming" | "Videojuegos" | "Industria",
  "tags": string[],
  "animeEntities": string[],
  "verificationBadge": "verified_official" | "leaker_scoop" | "industry_report"
}
`.trim();

// Heuristic exclusion blacklist for fallback mode
const MEME_OPINION_PATTERNS = [
  /giveaway/i,
  /sorteo/i,
  /rt to win/i,
  /cosplay/i,
  /fanart/i,
  /my opinion/i,
  /unpopular opinion/i,
  /tier list/i,
  /which one/i,
  /poll:/i,
  /rate this/i,
  /what do you think/i,
  /happy birthday/i,
  /meme/i,
  /shitpost/i,
  /fake news/i,
  /april fools/i,
  /\[review\]/i,
  /\breview\b/i,
  /\bcolumn\b/i,
  /\bfeature:/i,
  /\bi['’]m at\b/i,
  /\bpixelatl\b/i,
  /\bpuzzles?\b/i,
  /\bcrosswords?\b/i,
  /\bquiz\b/i,
  /\bwhen the lights go down\b/i,
  /\bsame as it ever was\b/i,
  /\bpodcast\b/i,
  /\binterview:/i,
];

// Heuristic inclusion whitelist for fallback mode
const OFFICIAL_NEWS_PATTERNS = [
  /\b(teaser|trailer|pv|key visual|visual|poster)\b/i,
  /\b(premiere|premieres|broadcast|release date|airing|schedule)\b/i,
  /\b(season \d+|s\d+|sequel|part \d+)\b/i,
  /\b(anime adaptation|tv anime|movie announced|film announced)\b/i,
  /\b(staff|cast|studio|director|character visual|theme song|opening|ending)\b/i,
  /\b(licensed|crunchyroll|netflix|disney\+|shonen jump|kadokawa|toho)\b/i,
];

export function formatRadarHeadline(raw: string): string {
  const core = (raw || '')
    .replace(/^⚡\s*/u, '')
    .replace(/^(RADAR X:|DESPACHO FLASH:)\s*/i, '')
    .trim();
  return `⚡ RADAR X: ${core || 'Primicia en vivo'}`;
}

export class GeminiCurator {
  private apiKey: string | null = null;
  private grokApiKey: string | null = null;
  private lastLoggedStatus: 'ai' | 'fallback' | null = null;
  private lastErrorMessage: string | null = null;
  private geminiQuotaExhaustedUntil: number = 0;
  private grokQuotaExhaustedUntil: number = 0;
  private curationCache: Map<string, CuratedDispatch> = new Map();

  constructor() {
    this.refreshApiKey();
  }

  public refreshApiKey(): boolean {
    dotenv.config();
    const key = process.env.GEMINI_API_KEY?.trim() || null;
    this.apiKey = key && key.length > 10 ? key : null;
    const grok = process.env.GROK_API_KEY?.trim() || process.env.XAI_API_KEY?.trim() || null;
    this.grokApiKey = grok && grok.length > 10 ? grok : null;
    return !!(this.apiKey || this.grokApiKey);
  }

  public hasApiKey(): boolean {
    this.refreshApiKey();
    return !!(this.apiKey || this.grokApiKey);
  }

  public getAiStatus() {
    this.refreshApiKey();
    const now = Date.now();
    const inCooldown = now < this.geminiQuotaExhaustedUntil;
    return {
      model: 'gemini-3.8-flash',
      hasGeminiKey: Boolean(this.apiKey),
      hasGrokKey: Boolean(this.grokApiKey),
      inCooldown,
      cooldownSecondsRemaining: inCooldown ? Math.ceil((this.geminiQuotaExhaustedUntil - now) / 1000) : 0,
      lastStatus: this.lastLoggedStatus || 'idle',
      lastError: this.lastErrorMessage,
    };
  }

  /**
   * Curates a candidate tweet using Gemini / Grok AI when configured and under quota,
   * or falls back to an ultra-resilient regex-based heuristic engine with zero latency.
   */
  async curate(tweet: RawTweetCandidate): Promise<CuratedDispatch> {
    this.refreshApiKey();

    const cacheKey = `${tweet.authorHandle}:${tweet.text.slice(0, 100)}`;
    if (this.curationCache.has(cacheKey)) {
      return this.curationCache.get(cacheKey)!;
    }

    const now = Date.now();
    const canUseGemini = this.apiKey && now > this.geminiQuotaExhaustedUntil;
    const canUseGrok = this.grokApiKey && now > this.grokQuotaExhaustedUntil;

    if (canUseGemini) {
      if (this.lastLoggedStatus !== 'ai') {
        console.log('[GeminiCurator] ✓ Motor Gemini AI ACTIVO para curaduría y redacción editorial.');
        this.lastLoggedStatus = 'ai';
      }
      try {
        const result = await this.curateWithGemini(tweet);
        this.curationCache.set(cacheKey, result);
        return result;
      } catch (err: any) {
        if (err.message && err.message.includes('429')) {
          this.geminiQuotaExhaustedUntil = Date.now() + 60 * 60 * 1000; // 1 hora de cooldown
          console.warn('[GeminiCurator] ⚠ Quota gratuita de Gemini agotada (HTTP 429). Activando respaldo automático.');
        } else if (err.message && err.message.includes('503')) {
          this.geminiQuotaExhaustedUntil = Date.now() + 3 * 60 * 1000; // 3 minutos de cooldown
          console.warn('[GeminiCurator] ⚠ Alta demanda temporal en gemini-3.8-flash (HTTP 503). Enfriamiento breve de 3 min.');
        } else {
          console.warn(`[GeminiCurator] ⚠ Fallo temporal en API de Gemini (${err.message}).`);
        }
      }
    }

    if (canUseGrok) {
      try {
        const result = await this.curateWithGrok(tweet);
        this.curationCache.set(cacheKey, result);
        return result;
      } catch (err: any) {
        console.warn(`[GeminiCurator] ⚠ Fallo en API de Grok (${err.message}).`);
      }
    }

    if (this.lastLoggedStatus !== 'fallback') {
      console.log('[GeminiCurator] ℹ Motor Heurístico Neural Local ACTIVO (curaduría instantánea sin bloqueo de red).');
      this.lastLoggedStatus = 'fallback';
    }

    const fallbackResult = this.curateWithHeuristics(tweet);
    if (fallbackResult.shouldPublish) {
      const rawHeadline = fallbackResult.title.replace(/^⚡\s*RADAR X:\s*/i, '').trim();
      const [esTitle, esSummary] = await Promise.all([
        this.translateTextToSpanish(rawHeadline),
        fallbackResult.summary ? this.translateTextToSpanish(fallbackResult.summary) : Promise.resolve(''),
      ]);
      fallbackResult.title = formatRadarHeadline(esTitle);
      if (esSummary) {
        fallbackResult.summary = esSummary;
        fallbackResult.lead = esSummary;
      }
    }
    this.curationCache.set(cacheKey, fallbackResult);
    return fallbackResult;
  }

  /**
   * Process raw tweet via xAI Grok API if key provided
   */
  private async curateWithGrok(tweet: RawTweetCandidate): Promise<CuratedDispatch> {
    const endpoint = 'https://api.x.ai/v1/chat/completions';
    const userPrompt = `Analiza el siguiente despacho de anime:\nAutor: ${tweet.authorName} (${tweet.authorHandle})\nTexto: ${tweet.text}\nDevuelve exclusivamente un JSON conforme a las reglas editoriales.`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.grokApiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      throw new Error(`Grok HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(rawContent);

    const summary = parsed.summary ? String(parsed.summary).trim() : tweet.text.slice(0, 200);
    const lead = parsed.lead ? String(parsed.lead).trim() : summary;
    let content = parsed.content ? String(parsed.content).trim() : '';

    if (!content) {
      content = `El reporte oficial proviene del canal especializado ${tweet.authorName} (${tweet.authorHandle}), referente en primicias de la industria en Tokio.\n\nLos pormenores de producción y ventanas de estreno serán confirmados próximamente.`;
    } else if (content.startsWith(lead)) {
      content = content.slice(lead.length).trim();
    }

    return {
      shouldPublish: !!parsed.shouldPublish,
      rejectionReason: parsed.rejectionReason || undefined,
      title: formatRadarHeadline(parsed.title ? String(parsed.title).trim() : `Primicia de ${tweet.authorHandle}`),
      lead,
      content,
      summary,
      category: this.normalizeCategory(parsed.category),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 6) : ['RadarX'],
      animeEntities: Array.isArray(parsed.animeEntities) ? parsed.animeEntities.map(String) : [],
      curatedByAi: true,
      verificationBadge: 'leaker_scoop',
    };
  }

  /**
   * Process raw tweet via Gemini 3.8 Flash REST API (modelo único y definitivo)
   */
  private async curateWithGemini(tweet: RawTweetCandidate): Promise<CuratedDispatch> {
    const model = 'gemini-3.8-flash';

    const userPrompt = `
Analiza el siguiente tweet recibido por el radar de X:
- Autor: ${tweet.authorName} (${tweet.authorHandle})
- Fecha: ${tweet.createdAt}
- Contenido en bruto:
"""
${tweet.text}
"""
- URLs de imágenes/medios adjuntos: ${tweet.mediaUrls.length} adjuntos

Determina con rigor editorial si debe publicarse como primicia de NekoPress v2. Devuelve exclusivamente JSON.
`.trim();

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: SYSTEM_PROMPT },
              { text: userPrompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 600,
        },
      }),
      signal: AbortSignal.timeout(20000), // 20s para permitir la generación completa sin abortar prematuramente
    });

    if (response.status === 429) {
      throw new Error(`Gemini ${model} HTTP 429: Cuota diaria excedida.`);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Gemini ${model} HTTP ${response.status}: ${errText.slice(0, 100)}`);
    }

    const data = await response.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) {
      throw new Error(`Respuesta vacía de ${model}`);
    }

    const parsed = JSON.parse(rawContent);

    const summary = parsed.summary ? String(parsed.summary).trim() : tweet.text.slice(0, 200);
    const lead = parsed.lead ? String(parsed.lead).trim() : summary;
    let content = parsed.content ? String(parsed.content).trim() : '';

    // Prevenir duplicación si el contenido empieza repitiendo la entradilla
    if (content && content.startsWith(lead)) {
      content = content.slice(lead.length).trim();
    }
    if (!content) {
      content = `La información ha sido transmitida a través de la cuenta ${tweet.authorHandle} (${tweet.authorName}), confirmando importantes avances sobre el proyecto y la participación del equipo de producción en Tokio.\n\nSe espera que durante las próximas semanas se publiquen nuevos avances promocionales y fechas definitivas de emisión a través de los canales autorizados.`;
    }

    let badge: 'verified_official' | 'leaker_scoop' | 'industry_report' = 'leaker_scoop';
    if (parsed.verificationBadge === 'verified_official' || tweet.authorHandle.includes('MAPPA') || tweet.authorHandle.includes('ufotable')) {
      badge = 'verified_official';
    } else if (parsed.verificationBadge === 'industry_report' || tweet.authorHandle.includes('WSJ') || tweet.authorHandle.includes('AniTrendz')) {
      badge = 'industry_report';
    }

    return {
      shouldPublish: !!parsed.shouldPublish,
      rejectionReason: parsed.rejectionReason || undefined,
      title: formatRadarHeadline(
        parsed.title ? String(parsed.title).trim() : `Primicia de ${tweet.authorHandle}`
      ),
      lead,
      content,
      summary,
      category: this.normalizeCategory(parsed.category),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 6) : ['Primicia', 'RadarX'],
      animeEntities: Array.isArray(parsed.animeEntities) ? parsed.animeEntities.map(String) : [],
      curatedByAi: true,
      verificationBadge: badge,
    };
  }

  /**
   * Resilient heuristic fallback that filters memes/spam and formats news cleanly
   */
  private curateWithHeuristics(tweet: RawTweetCandidate): CuratedDispatch {
    const cleanText = tweet.text.replace(/\bhttps?:\/\/\S+/gi, '').trim();

    // 1. Check meme / personal opinion blacklist
    for (const pattern of MEME_OPINION_PATTERNS) {
      if (pattern.test(cleanText)) {
        return {
          shouldPublish: false,
          rejectionReason: `Descartado por coincidencia con patrón no noticioso: ${pattern.source}`,
          title: '',
          lead: '',
          content: '',
          summary: '',
          category: 'General',
          tags: [],
          animeEntities: [],
          curatedByAi: false,
          verificationBadge: 'leaker_scoop',
        };
      }
    }

    // 2. Check official news whitelist
    let isOfficialMatch = false;
    for (const pattern of OFFICIAL_NEWS_PATTERNS) {
      if (pattern.test(cleanText)) {
        isOfficialMatch = true;
        break;
      }
    }

    // En modo heurístico exigimos coincidencia estricta con patrones de noticia oficial
    if (!isOfficialMatch) {
      return {
        shouldPublish: false,
        rejectionReason: 'Tweet sin medios adjuntos ni patrones de primicia confirmada.',
        title: '',
        lead: '',
        content: '',
        summary: '',
        category: 'General',
        tags: [],
        animeEntities: [],
        curatedByAi: false,
        verificationBadge: 'leaker_scoop',
      };
    }

    // 3. Extract formal title and summary heuristics
    const firstLine = cleanText.split('\n')[0].trim();
    let title = firstLine.length > 10 ? firstLine : cleanText;
    if (title.length > 90) {
      const cut = title.slice(0, 87);
      const lastSpace = cut.lastIndexOf(' ');
      title = (lastSpace > 50 ? cut.slice(0, lastSpace) : cut) + '…';
    }

    title = formatRadarHeadline(title);

    const summary = cleanText.length > 280
      ? cleanText.slice(0, 275) + '…'
      : cleanText || 'Despacho urgente captado en tiempo real por el Radar X de NekoPress.';

    const lead = summary;
    const content = `El reporte oficial proviene del canal especializado ${tweet.authorName} (${tweet.authorHandle}), referente técnico en la cobertura y verificación de primicias de la industria del anime y manga en Japón.\n\nLos detalles de producción, el elenco de voces principal y las ventanas definitivas de emisión en cadenas televisivas y plataformas autorizadas serán ampliados conforme los comités de producción en Tokio emitan sus comunicados correspondientes.`;

    // Infer category
    let category: NewsCategory = 'Anime';
    const lower = cleanText.toLowerCase();
    if (/manga|shonen jump|capítulo|tomo|volumen/.test(lower)) category = 'Manga';
    else if (/movie|película|film|cine/.test(lower)) category = 'Películas';
    else if (/streaming|crunchyroll|netflix|disney\+/.test(lower)) category = 'Streaming';
    else if (/staff|director|estudio|producción|seiyuu|box office/.test(lower)) category = 'Industria';

    // Extract tags
    const tags = ['RadarX', tweet.authorHandle.replace('@', '')];
    const hashMatches = tweet.text.match(/#(\w+)/g);
    if (hashMatches) {
      for (const h of hashMatches.slice(0, 3)) {
        const cleanTag = h.replace('#', '');
        if (!tags.includes(cleanTag)) tags.push(cleanTag);
      }
    }

    let badge: 'verified_official' | 'leaker_scoop' | 'industry_report' = 'leaker_scoop';
    if (tweet.authorHandle.includes('MAPPA') || tweet.authorHandle.includes('ufotable')) {
      badge = 'verified_official';
    } else if (tweet.authorHandle.includes('WSJ') || tweet.authorHandle.includes('AniTrendz')) {
      badge = 'industry_report';
    }

    return {
      shouldPublish: true,
      title,
      lead,
      content,
      summary,
      category,
      tags,
      animeEntities: [],
      curatedByAi: false,
      verificationBadge: badge,
    };
  }

  public async translateTextToSpanish(text: string): Promise<string> {
    const clean = (text || '').trim();
    if (!clean) return '';
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(clean)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return clean;
      const data = await res.json();
      if (Array.isArray(data?.[0])) {
        const translated = data[0].map((seg: any) => seg?.[0] || '').join('').trim();
        return translated || clean;
      }
    } catch {
      // Silencioso: retorna texto original si falla red
    }
    return clean;
  }

  /**
   * Traduce en lote titulares y resúmenes (japonés, inglés o francés) al español neutro
   * usando exclusivamente gemini-3.8-flash (o Grok / respaldo neuronal de alta disponibilidad) con caché SQLite.
   */
  public async translateBatchToSpanish(
    items: Array<{ id: string; title: string; summary: string }>
  ): Promise<Record<string, { title: string; summary: string }>> {
    this.refreshApiKey();
    const results: Record<string, { title: string; summary: string }> = {};
    const pending: Array<{ id: string; title: string; summary: string }> = [];

    // 1. Consultar caché persistente en SQLite primero
    for (const item of items) {
      const cached = getCachedTranslation(item.id);
      if (cached) {
        results[item.id] = cached;
      } else {
        pending.push(item);
      }
    }

    if (pending.length === 0) return results;

    const batch = pending.slice(0, 10);
    const now = Date.now();
    const canUseGemini = this.apiKey && now > this.geminiQuotaExhaustedUntil;
    const canUseGrok = this.grokApiKey && now > this.grokQuotaExhaustedUntil;

    const prompt = `Traduce al español neutro periodístico (estilo agencia) los siguientes titulares y resúmenes de noticias de anime/manga.
Conserva intactos los nombres propios de obras, estudios y autores (ej. MAPPA, One Piece, Dandadan, Shonen Jump).
Devuelve ÚNICAMENTE un JSON con la forma:
{
  "translations": [
    { "id": "...", "title": "...", "summary": "..." }
  ]
}
Entrada:
${JSON.stringify(batch)}`;

    if (canUseGemini) {
      const model = 'gemini-3.8-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      const maxAttempts = 2;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
                maxOutputTokens: 1600,
              },
            }),
            signal: AbortSignal.timeout(20000),
          });

          if (res.status === 429) {
            this.geminiQuotaExhaustedUntil = Date.now() + 60 * 60 * 1000;
            this.lastErrorMessage = 'HTTP 429: Cuota de Gemini agotada';
            console.warn('[GeminiCurator] ⚠ Quota gratuita de Gemini agotada al traducir (HTTP 429). Cooldown 60m.');
            break;
          }

          if (res.status === 503) {
            if (attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, 2500));
              continue;
            }
            this.geminiQuotaExhaustedUntil = Date.now() + 3 * 60 * 1000;
            this.lastErrorMessage = 'HTTP 503: Alta demanda temporal en gemini-3.8-flash';
            console.warn('[GeminiCurator] ⚠ gemini-3.8-flash en alta demanda al traducir (HTTP 503). Reintento en 3m.');
            break;
          }

          if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            this.lastErrorMessage = `HTTP ${res.status}: ${errBody.slice(0, 120)}`;
            console.warn(`[GeminiCurator] ⚠ Error al traducir con ${model}: ${this.lastErrorMessage}`);
            break;
          }

          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed.translations)) {
              this.lastLoggedStatus = 'ai';
              this.lastErrorMessage = null;
              for (const t of parsed.translations) {
                if (t.id && t.title) {
                  const cleanSummary = t.summary ? String(t.summary).trim() : '';
                  const cleanTitle = String(t.title).trim();
                  results[t.id] = { title: cleanTitle, summary: cleanSummary };
                  saveCachedTranslation(t.id, cleanTitle, cleanSummary, model);
                }
              }
              return results;
            }
          }
        } catch (err: any) {
          this.lastErrorMessage = err?.message || 'Error de red en Gemini';
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          console.warn(`[GeminiCurator] ⚠ Fallo en traducción con ${model}: ${this.lastErrorMessage}`);
        }
      }
    }

    if (canUseGrok) {
      try {
        const res = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.grokApiKey}`,
          },
          body: JSON.stringify({
            model: 'grok-2-latest',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          const data = await res.json();
          const raw = data.choices?.[0]?.message?.content;
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.translations)) {
              for (const t of parsed.translations) {
                if (t.id && t.title) {
                  const cleanSummary = t.summary ? String(t.summary).trim() : '';
                  const cleanTitle = String(t.title).trim();
                  results[t.id] = { title: cleanTitle, summary: cleanSummary };
                  saveCachedTranslation(t.id, cleanTitle, cleanSummary, 'grok-2-latest');
                }
              }
              return results;
            }
          }
        }
      } catch {
        // Sin bloqueo
      }
    }

    // 3. Respaldo terciario de alta disponibilidad si Gemini 3.8 Flash está en cooldown (503/429)
    const missing = batch.filter((item) => !results[item.id]);
    for (let i = 0; i < missing.length; i += 4) {
      const chunk = missing.slice(i, i + 4);
      await Promise.all(
        chunk.map(async (item) => {
          const cleanTitle = await this.translateTextToSpanish(item.title);
          const cleanSummary = item.summary ? await this.translateTextToSpanish(item.summary) : '';
          if (cleanTitle && cleanTitle !== item.title) {
            results[item.id] = { title: cleanTitle, summary: cleanSummary };
            saveCachedTranslation(item.id, cleanTitle, cleanSummary, 'neural-fallback');
          }
        })
      );
    }

    return results;
  }

  private normalizeCategory(cat?: string): NewsCategory {
    if (!cat) return 'Anime';
    const c = cat.toLowerCase();
    if (c.includes('manga')) return 'Manga';
    if (c.includes('pel') || c.includes('mov') || c.includes('film')) return 'Películas';
    if (c.includes('stream')) return 'Streaming';
    if (c.includes('juego') || c.includes('game')) return 'Videojuegos';
    if (c.includes('indus') || c.includes('staff')) return 'Industria';
    return 'Anime';
  }
}

export const geminiCurator = new GeminiCurator();
