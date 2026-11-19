import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { onlineCatalog } from '../dist/services/onlineCatalog.js';

async function makeRequest(t) {
  const app = express();
  app.use('/api/catalogo-online', onlineCatalog);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return path => new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:' + server.address().port + '/api/catalogo-online/' + path, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), type: res.headers['content-type'] }));
    }).on('error', reject);
  });
}

test('Kitsu search requests JSON:API and preserves provider links', async t => {
  const get = await makeRequest(t);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.searchParams.get('filter[text]'), 'Bebop');
    assert.equal(options.headers.Accept, 'application/vnd.api+json');
    return Response.json({ data: [{ id: '1', attributes: { canonicalTitle: 'Cowboy Bebop', slug: 'cowboy-bebop' },
      relationships: { streamingLinks: { data: [{ type: 'streamingLinks', id: '8' }] } } }],
      included: [{ type: 'streamingLinks', id: '8', attributes: { url: 'https://example.org/series/bebop' } }], links: {} });
  });
  const result = await get('anime?q=Bebop');
  assert.equal(result.status, 200);
  const { items } = JSON.parse(result.body);
  assert.equal(items[0].title, 'Cowboy Bebop');
  assert.equal(items[0].links[0].url, 'https://example.org/series/bebop');
});

test('an unavailable provider returns the saved popular shelf only for its original query', async t => {
  const get = await makeRequest(t);
  t.mock.method(globalThis, 'fetch', async () => { throw Error('offline'); });
  const popular = JSON.parse((await get('manga')).body);
  assert.equal(popular.saved, true);
  assert.equal(popular.items.length, 12);
  assert.equal((await get('manga?q=irrepetible')).status, 503);
});

test('the reader renews a failed page assignment and accepts the replacement image', async t => {
  const get = await makeRequest(t);
  const chapter = '11111111-aaaa-bbbb-cccc-111111111111';
  let manifests = 0;
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    if (url.hostname === 'api.mangadex.org') {
      manifests++;
      return Response.json({ baseUrl: 'https://uploads.mangadex.org', chapter: { hash: 'abc', dataSaver: ['p' + manifests + '.jpg'] } });
    }
    return url.pathname.endsWith('/p1.jpg') ? new Response(null, { status: 503 })
      : new Response(Buffer.from([255,216,255,217]), { headers: { 'content-type': 'image/jpeg' } });
  });
  const manifest = JSON.parse((await get('capitulo/' + chapter + '/paginas')).body);
  assert.deepEqual(manifest.pages, ['/api/catalogo-online/capitulo/' + chapter + '/pagina/1']);
  const result = await get('capitulo/' + chapter + '/pagina/1');
  assert.equal(result.status, 200);
  assert.equal(result.type, 'image/jpeg');
  assert.equal(manifests, 2);
});
