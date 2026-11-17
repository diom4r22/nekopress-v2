/**
 * Sube todo el proyecto NekoPress v2 a un repositorio de GitHub usando la API REST oficial de GitHub
 * (no requiere tener git ni gh instalados en el sistema).
 *
 * Uso:
 *   GITHUB_TOKEN=ghp_xxx node scripts/push-to-github.mjs [nombre-repo] [private|public]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const TOKEN = process.env.GITHUB_TOKEN?.trim();
const REPO_NAME = process.argv[2] || 'nekopress-v2';
const IS_PRIVATE = (process.argv[3] || 'private').toLowerCase() !== 'public';

if (!TOKEN) {
  console.error('Error: Falta la variable de entorno GITHUB_TOKEN.');
  process.exit(1);
}

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'cache']);
const EXCLUDE_FILES = new Set(['.env', 'nekopress.db-shm', 'nekopress.db-wal']);

function collectFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let results = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.tmp') || entry.name.endsWith('.tmp') || entry.name.endsWith('.log')) continue;
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      results = results.concat(collectFiles(fullPath, relPath));
    } else if (entry.isFile()) {
      if (EXCLUDE_FILES.has(entry.name)) continue;
      results.push({ relPath, fullPath });
    }
  }
  return results;
}

async function ghFetch(endpoint, options = {}) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'NekoPress-v2-Uploader',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} (${endpoint}): ${data?.message || text}`);
  }
  return data;
}

(async () => {
  // 1. Obtener usuario autenticado
  const user = await ghFetch('/user');
  const owner = user.login;
  console.log(`✓ Autenticado en GitHub como: ${owner}`);

  // 2. Crear o verificar repositorio
  let repo;
  try {
    repo = await ghFetch(`/repos/${owner}/${REPO_NAME}`);
    console.log(`ℹ El repositorio ${owner}/${REPO_NAME} ya existe.`);
  } catch {
    console.log(`Creando repositorio ${owner}/${REPO_NAME} (${IS_PRIVATE ? 'Privado' : 'Público'})...`);
    repo = await ghFetch('/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name: REPO_NAME,
        description: '猫PRESS v2 — Anime Intelligence & Streaming Wire (React + TypeScript + Express + SQLite)',
        private: IS_PRIVATE,
        auto_init: true,
      }),
    });
    // Esperar breve instante a que GitHub inicialice la rama por defecto
    await new Promise((r) => setTimeout(r, 1500));
  }

  const branch = repo.default_branch || 'main';
  const files = collectFiles(ROOT_DIR);
  console.log(`Subiendo ${files.length} archivos del proyecto a ${owner}/${REPO_NAME} (${branch})...`);

  // 3. Crear blobs para todos los archivos
  const treeItems = [];
  for (let i = 0; i < files.length; i += 6) {
    const batch = files.slice(i, i + 6);
    await Promise.all(
      batch.map(async (f) => {
        const contentBase64 = fs.readFileSync(f.fullPath).toString('base64');
        const blob = await ghFetch(`/repos/${owner}/${REPO_NAME}/git/blobs`, {
          method: 'POST',
          body: JSON.stringify({ content: contentBase64, encoding: 'base64' }),
        });
        treeItems.push({
          path: f.relPath,
          mode: '100644',
          type: 'blob',
          sha: blob.sha,
        });
      })
    );
  }

  // 4. Obtener commit padre si existe
  let parentSha = null;
  try {
    const ref = await ghFetch(`/repos/${owner}/${REPO_NAME}/git/ref/heads/${branch}`);
    parentSha = ref.object.sha;
  } catch {}

  // 5. Crear árbol Git y commit
  const tree = await ghFetch(`/repos/${owner}/${REPO_NAME}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ tree: treeItems }),
  });

  const commit = await ghFetch(`/repos/${owner}/${REPO_NAME}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'feat: NekoPress v2 — Anime Intelligence & Streaming Wire (auditado y mejorado)',
      tree: tree.sha,
      parents: parentSha ? [parentSha] : [],
    }),
  });

  // 6. Actualizar referencia de la rama
  if (parentSha) {
    await ghFetch(`/repos/${owner}/${REPO_NAME}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: true }),
    });
  } else {
    await ghFetch(`/repos/${owner}/${REPO_NAME}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
    });
  }

  console.log(`\n✅ ¡Proyecto subido exitosamente!`);
  console.log(`🔗 URL del repositorio: ${repo.html_url}`);
})();
