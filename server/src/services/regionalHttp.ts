export async function request(url: URL, body?: URLSearchParams) {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', body,
    headers: { 'User-Agent': 'NekoPress/2.0' }, redirect: 'error', signal: AbortSignal.timeout(12000) });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw Error('No se pudo consultar la fuente.');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 5 * 1024 * 1024) { await reader.cancel(); throw Error('Respuesta de catálogo demasiado grande'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function href(value: string | undefined, origin: string, domain = new URL(origin).hostname) {
  if (!value) return '';
  try {
    const url = new URL(value, origin);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === domain || url.hostname.endsWith('.' + domain)) ? url.href : '';
  } catch { return ''; }
}
