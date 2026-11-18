import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import https from 'node:https';
import { Readable } from 'node:stream';
import test from 'node:test';
import { handleImageProxy } from '../dist/services/imageProxy.js';

async function requestImage(url) {
  const result = { headers: {} };
  await handleImageProxy({ query: { url } }, {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.status = code; return this; },
    send(body) { result.body = body; },
  });
  return result;
}

test('follows a trusted image redirect and uses the browser fallback for an unavailable image', async t => {
  const original = 'https://cdn.myanimelist.net/' + crypto.randomUUID();
  const destination = 'https://a.storyblok.com/poster.png';
  const cacheKey = crypto.createHash('sha256').update(original).digest('hex');
  t.after(async () => {
    for (const suffix of ['bin', 'json']) {
      await fs.rm(new URL(`../data/cache/images/${cacheKey}.${suffix}`, import.meta.url), { force: true });
    }
  });

  t.mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
  const requested = [];
  t.mock.method(https, 'get', (url, options, callback) => {
    requested.push(url.href);
    const firstHop = url.href === original;
    const response = Readable.from(firstHop ? [] : [Buffer.alloc(128)]);
    response.statusCode = firstHop ? 302 : 200;
    response.headers = firstHop ? { location: destination } : { 'content-type': 'image/png' };
    queueMicrotask(() => callback(response));
    return new EventEmitter();
  });

  const image = await requestImage(original);
  assert.deepEqual(requested, [original, destination]);
  assert.equal(image.status, 200);
  assert.equal(image.headers['Content-Type'], 'image/png');
  assert.equal(image.body.length, 128);

  const unsupported = await requestImage('https://example.com/poster.png');
  assert.equal(unsupported.status, 404);
  assert.equal(requested.length, 2);
});
