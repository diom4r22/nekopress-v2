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

test('regional catalogues cannot use a different source or collection as a fallback', async t => {
  const get = await makeRequest(t);
  const upstream = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
  assert.equal((await get('manga?source=jkanime')).status, 400);
  assert.equal(upstream.mock.callCount(), 0);
  assert.equal((await get('anime?source=tioanime')).status, 503);
});

test('TíoAnime uses the listed episode numbers and serves only the supported embedded players', async t => {
  const get = await makeRequest(t);
  const iframe = 'https://www.yourupload.com/embed/episode-3';
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url.hostname, 'tioanime.com');
    if (url.pathname === '/anime/serie-prueba') return new Response('<script>\nvar episodes = [3,1,3];\n</script>');
    assert.equal(url.pathname, '/ver/serie-prueba-3');
    const videos = [['Other', 'https://example.org/embed/3'], ['OK', 'https://ok.ru/videoembed/3'],
      ['Tío', 'https://v.tioanime.com/embed.php-extra'], ['YourUpload', iframe], ['YourUpload', iframe]];
    return new Response('<script>var videos = ' + JSON.stringify(videos) + ';</script>');
  });
  const { items } = JSON.parse((await get('fuente/tioanime/serie-prueba/entregas')).body);
  assert.deepEqual(items.map(i => i.episode), [1, 3]);
  const result = await get('reproductor/tioanime/serie-prueba/3');
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.body).players, [
    { label: 'YourUpload', url: iframe }, { label: 'OK', url: 'https://ok.ru/videoembed/3' },
  ]);
});

test('JKAnime selects its published default and labels the alternate player', async t => {
  const get = await makeRequest(t);
  const html = [
    '<a class="servers" data-id="0">Desu</a><a class="servers" data-id="1">Magi</a>',
    '<iframe src="https://example.org/unrelated"></iframe><script>',
    'video[0] = \'<iframe class="player_conte" src="https://jkanime.net/jkplayer/um?e=first"></iframe>\';',
    'video[1] = \'<iframe class="player_conte" src="https://jkanime.net/jkplayer/umv?e=second"></iframe>\';',
    'video[2] = \'<iframe class="player_conte" src="https://example.org/ad"></iframe>\';',
    'var video_data = video[1];</script>',
  ].join('\n');
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url.href, 'https://jkanime.net/serie-prueba/1/');
    return new Response(html);
  });
  const result = await get('reproductor/jkanime/serie-prueba/1');
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.body).players, [
    { label: 'Magi', url: 'https://jkanime.net/jkplayer/umv?e=second' },
    { label: 'Desu', url: 'https://jkanime.net/jkplayer/um?e=first' },
  ]);
});

test('InManga returns the requested chapter and its pages in reading order', async t => {
  const get = await makeRequest(t);
  const series = 'aaaaaaaa-bbbb-cccc-dddd-111111111111', chapter = 'aaaaaaaa-bbbb-cccc-dddd-222222222222';
  const first = 'aaaaaaaa-bbbb-cccc-dddd-333333333333', second = 'aaaaaaaa-bbbb-cccc-dddd-444444444444';
  const cdn = 'https://cdn1.intomanga.com/i/m/Luna/';
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url.hostname, 'inmanga.com');
    if (url.pathname === '/chapter/getall') {
      assert.equal(url.searchParams.get('mangaIdentification'), series);
      return Response.json({ data: JSON.stringify({ success: true, result: [
        { Number: 1, Identification: chapter, FriendlyChapterNumberUrl: '1' },
      ] }) });
    }
    if (url.pathname === '/chapter/chapterIndexControls') {
      assert.equal(url.searchParams.get('identification'), chapter);
      return new Response('<input id="ChapterIdentification" value="' + chapter + '">' +
        '<input id="FriendlyMangaName" value="Luna"><input id="FriendlyChapterNumberUrl" value="1">' +
        '<img class="ImageContainer" data-pagenumber="2" id="' + second + '">' +
        '<img class="ImageContainer" data-pagenumber="1" id="' + first + '">');
    }
    assert.equal(url.pathname, '/ver/manga/Luna/1/' + chapter);
    return new Response('<script>var pu = "' + cdn + 'identification.jpg";</script>');
  });
  const list = JSON.parse((await get('fuente/inmanga/' + series + '/entregas?serie=Luna')).body);
  assert.equal(list.items[0].chapterId, chapter);
  const result = await get('lectura/inmanga/' + list.items[0].chapterId + '/paginas');
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.body).pages, [cdn + first + '.jpg', cdn + second + '.jpg']);
});

test('Olympus searches accents and paginates across the complete index', async t => {
  const get = await makeRequest(t);
  const data = Array.from({ length: 13 }, (_, i) => ({ type: 'comic', slug: 'volumen-' + (i + 1), name: 'Héroe ' + (i + 1) }));
  data.push({ type: 'novel', slug: 'novela', name: 'Héroe 0' });
  const upstream = t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url.href, 'https://olympusxyz.com/api/series/list');
    return Response.json({ data });
  });
  const first = JSON.parse((await get('manga?source=olympus&q=heroe&sort=az')).body);
  assert.equal(first.items.length, 12);
  assert.equal(first.next, true);
  const last = JSON.parse((await get('manga?source=olympus&q=heroe&sort=az&page=1')).body);
  assert.deepEqual(last.items.map(i => i.title), ['Héroe 13']);
  assert.equal(last.next, false);
  assert.equal(upstream.mock.callCount(), 1);
});

test('a hosted MangaDex chapter links to its scanlation group', async t => {
  const get = await makeRequest(t);
  const series = '44444444-aaaa-bbbb-cccc-111111111111', group = '44444444-aaaa-bbbb-cccc-222222222222';
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url.searchParams.get('includes[]'), 'scanlation_group');
    return Response.json({ total: 1, data: [{ id: series, attributes: { chapter: '1', pages: 2, translatedLanguage: 'es-la' },
      relationships: [{ type: 'scanlation_group', id: group, attributes: { name: 'Grupo Norte' } }] }] });
  });
  const { items } = JSON.parse((await get('manga/' + series + '/capitulos')).body);
  assert.equal(items[0].chapterId, series);
  assert.deepEqual(items[0].groups, [{ name: 'Grupo Norte', url: 'https://mangadex.org/group/' + group }]);
});
