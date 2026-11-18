import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyNews, hasRadarContext } from '../dist/services/editorial.js';

test('the central subject takes precedence over mentions elsewhere in the article', () => {
  assert.equal(classifyNews('Cypress Hill anuncia concierto en México', '', 'Anime'), 'Industria');
  assert.equal(classifyNews('Castlevania recibe un nuevo videojuego', 'Basado en el manga', 'Manga'), 'Videojuegos');
  assert.equal(classifyNews('El manga Witch Hat Atelier tendrá un anime'), 'Anime');
  assert.equal(classifyNews('Crunchyroll estrena el doblaje de Frieren'), 'Streaming');
});

test('radar rejects incomplete fragments and keeps announcements in multiple languages', () => {
  assert.equal(hasRadarContext('The good news is that its early chapters...'), false);
  assert.equal(hasRadarContext('Trailer! https://example.com/post'), false);
  assert.equal(hasRadarContext('Frieren season 2 premieres in January.'), true);
  assert.equal(hasRadarContext('テレビアニメの新シーズンが来年一月に放送決定'), true);
});
