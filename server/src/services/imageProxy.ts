/**
 * 猫PRESS v2 — Local Image Proxy Service
 * Descarga, verifica y cachea imágenes en disco local para evitar bloqueos
 * de CORS, protecciones contra hotlink (Cloudflare/ANN/Crunchyroll/AniList) y caídas de red.
 * Incluye deduplicación de peticiones en vuelo, cola de concurrencia, reintentos y fallback SVG editorial.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import dns from 'dns/promises';
import net from 'net';
import { fileURLToPath } from 'url';
import { Request, Response } from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(__dirname, '..', '..', 'data', 'cache', 'images');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const inFlight = new Map<string, Promise<{ buffer: Buffer; contentType: string } | null>>();

// Limitador de concurrencia para evitar HTTP 429 / timeouts al cargar cientos de portadas
const MAX_CONCURRENT_FETCHES = 10;
let activeFetches = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeFetches < MAX_CONCURRENT_FETCHES) {
    activeFetches++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeFetches++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeFetches = Math.max(0, activeFetches - 1);
  const next = waitQueue.shift();
  if (next) next();
}

function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(url.trim()).digest('hex');
}

export function unwrapImageUrl(rawUrl: string): string {
  let current = rawUrl.trim();
  let safety = 0;
  while (current.startsWith('/api/image-proxy') && safety < 5) {
    safety++;
    try {
      const parsed = new URL(current, 'http://localhost');
      const inner = parsed.searchParams.get('url');
      if (inner) {
        current = inner.trim();
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  return current;
}

function buildFallbackSvg(label = 'NEKOPRESS'): Buffer {
  const safeLabel = label.replace(/[<>&"']/g, '').slice(0, 28) || 'NEKOPRESS';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#18181b"/>
        <stop offset="50%" stop-color="#09090c"/>
        <stop offset="100%" stop-color="#000000"/>
      </linearGradient>
    </defs>
    <rect width="600" height="800" fill="url(#bg)"/>
    <rect x="24" y="24" width="552" height="752" rx="16" fill="none" stroke="#27272a" stroke-width="2"/>
    <text x="50%" y="360" text-anchor="middle" fill="#dc2626" font-family="monospace" font-weight="900" font-size="28" letter-spacing="6">猫PRESS</text>
    <text x="50%" y="410" text-anchor="middle" fill="#f4f4f5" font-family="sans-serif" font-weight="700" font-size="20">${safeLabel}</text>
    <text x="50%" y="450" text-anchor="middle" fill="#71717a" font-family="monospace" font-size="14" letter-spacing="3">ARCHIVO VISUAL</text>
  </svg>`;
  return Buffer.from(svg, 'utf8');
}

// Only known image providers are permitted. Resolve once and pin the public IP
// for the connection, so DNS changes cannot redirect a request to a private host.
const IMAGE_HOSTS = new Set([
  'a.storyblok.com', 'www.animenewsnetwork.com', 'animeanime.jp',
  'img.anmosugoi.com', 'static.animecorner.me', 'cdn.myanimelist.net',
  'ramenparados.com', 's4.anilist.co', 's3.anilist.co', 's2.anilist.co',
  'cdn.bsky.app', 'cdn.animenewsnetwork.com', 'images.animecorner.me',
]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const blocked = new net.BlockList();
for (const [address, prefix] of [['0.0.0.0',8], ['10.0.0.0',8], ['100.64.0.0',10], ['127.0.0.0',8], ['169.254.0.0',16], ['172.16.0.0',12], ['192.168.0.0',16], ['192.0.0.0',24], ['198.18.0.0',15], ['224.0.0.0',4], ['240.0.0.0',4]] as Array<[string, number]>) blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [['::',128], ['::1',128], ['::ffff:0:0',96], ['fc00::',7], ['fe80::',10], ['ff00::',8]] as Array<[string, number]>) blocked.addSubnet(address, prefix, 'ipv6');

function allowedUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !IMAGE_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url;
  } catch { return null; }
}

async function downloadImage(raw: string): Promise<{buffer: Buffer; contentType: string} | null> {
  const url = allowedUrl(raw);
  if (!url) return null;
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(a => blocked.check(a.address, a.family === 6 ? 'ipv6' : 'ipv4'))) return null;
  const address = addresses[0];
  return new Promise((resolve) => {
    const req = https.get(url, {
      family: address.family,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif', Referer: `${url.origin}/` },
      timeout: 9000,
    }, response => {
      const contentType = (response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (response.statusCode !== 200 || !IMAGE_TYPES.has(contentType) || Number(response.headers['content-length'] || 0) > MAX_IMAGE_BYTES) {
        response.resume(); resolve(null); return;
      }
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_IMAGE_BYTES) { response.destroy(); resolve(null); }
        else chunks.push(chunk);
      });
      response.on('end', () => resolve(size >= 100 ? { buffer: Buffer.concat(chunks), contentType } : null));
      response.on('error', () => resolve(null));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

async function fetchUpstreamImage(
  targetUrl: string,
  cacheFilePath: string,
  metaFilePath: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  await acquireSlot();
  try {
    let origin = 'https://www.animenewsnetwork.com';
    try {
      const parsed = new URL(targetUrl);
      origin = parsed.origin;
      if (parsed.hostname.includes('bsky.app')) {
        origin = 'https://bsky.app';
      } else if (parsed.hostname.includes('anilist.co')) {
        origin = 'https://anilist.co';
      } else if (parsed.hostname.includes('myanimelist.net')) {
        origin = 'https://myanimelist.net';
      }
    } catch {
      // default origin
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const downloaded = await downloadImage(targetUrl);
        if (!downloaded) return null;
        const { buffer, contentType } = downloaded;

        // Guardado atómico en caché para evitar archivos truncados en lecturas concurrentes
        try {
          const tmpBin = `${cacheFilePath}.${process.pid}.${Date.now()}.tmp`;
          const tmpMeta = `${metaFilePath}.${process.pid}.${Date.now()}.tmp`;
          fs.writeFileSync(tmpBin, buffer);
          fs.writeFileSync(
            tmpMeta,
            JSON.stringify({
              url: targetUrl,
              contentType,
              savedAt: new Date().toISOString(),
              size: buffer.length,
            })
          );
          fs.renameSync(tmpBin, cacheFilePath);
          fs.renameSync(tmpMeta, metaFilePath);
        } catch {
          // Si falla el rename por bloqueo temporal de Windows, escribir directo
          try {
            fs.writeFileSync(cacheFilePath, buffer);
            fs.writeFileSync(
              metaFilePath,
              JSON.stringify({
                url: targetUrl,
                contentType,
                savedAt: new Date().toISOString(),
                size: buffer.length,
              })
            );
          } catch {}
        }

        return { buffer, contentType };
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }
    return null;
  } finally {
    releaseSlot();
  }
}

export async function handleImageProxy(req: Request, res: Response) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const rawParam = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  const targetUrl = unwrapImageUrl(rawParam);

  if (!allowedUrl(targetUrl)) {
    const fallback = buildFallbackSvg();
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(fallback);
  }

  const fileHash = hashUrl(targetUrl);
  const cacheFilePath = path.join(CACHE_DIR, `${fileHash}.bin`);
  const metaFilePath = path.join(CACHE_DIR, `${fileHash}.json`);

  // 1. Servir desde caché en disco si existe y es válido
  if (fs.existsSync(cacheFilePath) && fs.existsSync(metaFilePath)) {
    try {
      const stat = fs.statSync(cacheFilePath);
      if (stat.size >= 100 && stat.size <= MAX_IMAGE_BYTES) {
        const meta = JSON.parse(fs.readFileSync(metaFilePath, 'utf8'));
        if (!IMAGE_TYPES.has(meta.contentType)) throw new Error('Invalid cached content type');
        res.setHeader('Content-Type', meta.contentType);
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        res.setHeader('X-Proxy-Cache', 'HIT');
        return fs.createReadStream(cacheFilePath).pipe(res);
      }
    } catch {
      // Si el meta está corrupto, se refetch
    }
  }

  // 2. Deduplicar peticiones simultáneas para la misma URL
  let promise = inFlight.get(fileHash);
  if (!promise) {
    promise = fetchUpstreamImage(targetUrl, cacheFilePath, metaFilePath).finally(() => {
      inFlight.delete(fileHash);
    });
    inFlight.set(fileHash, promise);
  }

  const result = await promise;
  if (result) {
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('X-Proxy-Cache', 'MISS');
    return res.status(200).send(result.buffer);
  }

  // 3. Fallback visual limpio en lugar de romper el <img> en el navegador
  let hostLabel = 'NEKOPRESS';
  try {
    hostLabel = new URL(targetUrl).hostname.replace(/^www\./, '').toUpperCase();
  } catch {}
  const fallback = buildFallbackSvg(hostLabel);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('X-Proxy-Cache', 'FALLBACK');
  return res.status(200).send(fallback);
}
