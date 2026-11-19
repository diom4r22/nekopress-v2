import express, { type RequestHandler } from 'express';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../biblioteca/', import.meta.url));
const images = /\.(?:jpe?g|png|webp|avif)$/i;
const videos = /\.(?:mp4|webm)$/i;
const order = new Intl.Collator('es', { numeric: true });
const cookie = 'neko_biblioteca';
const cookiePath = '/api/biblioteca';
const sessionLength = 7 * 86400_000;

function validPart(value: string) {
  return !!value && !value.startsWith('.') && !/[\\/:\x00-\x1f]/.test(value);
}

async function entries(parts: string[], directories: boolean, allowed?: RegExp) {
  const folder = path.join(root, ...parts);
  if (!parts.every(validPart) || await realpath(folder) !== folder) return [];
  const contents = await readdir(folder, { withFileTypes: true });
  return contents.filter(item => validPart(item.name) && (directories ? item.isDirectory() : item.isFile())
    && (!allowed || allowed.test(item.name))).map(item => item.name).sort(order.compare);
}

async function shelf(kind: 'manga' | 'anime') {
  let names: string[];
  try { names = await entries([kind], true); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  return Promise.all(names.map(async name => ({
    name, items: await entries([kind, name], kind === 'manga', kind === 'anime' ? videos : undefined),
  })));
}

export function libraryRouter(password: string | undefined) {
  const router = express.Router();
  const sessions = new Map<string, number>();
  const sessionId = (cookies = '') => cookies.split(';').map(s => s.trim()).find(s => s.startsWith(cookie + '='))?.slice(cookie.length + 1) || '';
  const hash = (value: string) => createHash('sha256').update(value).digest();
  router.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    if (!password) { res.status(503).json({ error: 'La biblioteca compartida está desactivada.' }); return; }
    next();
  });
  router.post('/sesion', express.json({ limit: '4kb' }), (req, res) => {
    if (typeof req.body?.password !== 'string' || !timingSafeEqual(hash(req.body.password), hash(password!))) {
      res.status(401).json({ error: 'Clave incorrecta.' }); return;
    }
    const now = Date.now();
    for (const [id, expires] of sessions) if (expires <= now) sessions.delete(id);
    sessions.delete(sessionId(req.headers.cookie));
    const id = randomBytes(32).toString('hex');
    sessions.set(id, now + sessionLength);
    res.cookie(cookie, id, { path: cookiePath, httpOnly: true, sameSite: 'strict', maxAge: sessionLength,
      secure: req.secure || process.env.NODE_ENV === 'production' }).sendStatus(204);
  });
  router.delete('/sesion', (req, res) => {
    sessions.delete(sessionId(req.headers.cookie));
    res.clearCookie(cookie, { path: cookiePath }).sendStatus(204);
  });
  router.use((req, res, next) => {
    if ((sessions.get(sessionId(req.headers.cookie)) ?? 0) <= Date.now()) { res.sendStatus(401); return; }
    next();
  });
  router.get('/catalogo', (_req, res, next) => {
    Promise.all([shelf('manga'), shelf('anime')]).then(([manga, anime]) => res.json({ manga, anime })).catch(next);
  });
  router.get('/paginas/:serie/:capitulo', (req, res, next) => {
    entries(['manga', req.params.serie, req.params.capitulo], false, images)
      .then(pages => res.json({ pages })).catch(next);
  });
  const media: RequestHandler = (req, res, next) => {
    const parts = [req.params.serie, req.params.capitulo, req.params.archivo].filter((p): p is string => typeof p === 'string');
    const manga = parts.length === 3;
    if (!parts.every(validPart) || !(manga ? images : videos).test(parts[parts.length - 1])) { res.sendStatus(404); return; }
    const file = path.join(root, manga ? 'manga' : 'anime', ...parts);
    realpath(file).then(actual => {
      if (actual !== file) { res.sendStatus(404); return; }
      res.sendFile(file, { cacheControl: false }, err => { if (err) next(err); });
    }).catch(next);
  };
  router.get('/manga/:serie/:capitulo/:archivo', media);
  router.get('/anime/:serie/:archivo', media);
  const errors: express.ErrorRequestHandler = (err, _req, res, next) => {
    if (res.headersSent) { next(err); return; }
    const missing = err.code === 'ENOENT' || err.code === 'ENOTDIR';
    res.status(missing ? 404 : err.status || 500).json({ error: 'No se pudo cargar el contenido de la biblioteca.' });
  };
  router.use(errors);
  return router;
}
