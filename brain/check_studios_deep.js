import { animeLiveService } from 'file:///C:/Users/dariasa/.gemini/antigravity/scratch/nekopress-v2/server/dist/services/animeLiveService.js';

async function testStudios() {
  console.log('Awaiting animeLiveService.sync()...');
  const syncRes = await animeLiveService.sync();
  console.log('Sync finished with:', syncRes);

  const studios = animeLiveService.getStudios();
  console.log(`\n=== 10 ESTUDIOS CANÓNICOS EN VIVO: ${studios.length} REGISTRADOS ===`);
  
  for (const s of studios) {
    const dossier = animeLiveService.getStudioDossier(s.name);
    console.log(`\n🏢 ESTUDIO: ${s.name} (${dossier?.romajiName || ''})`);
    console.log(`   - Año de Fundación: ${s.foundedYear}`);
    console.log(`   - Sede Oficial: ${s.headquarters}`);
    console.log(`   - Directores / Fundadores: ${s.keyFounders}`);
    console.log(`   - Web Oficial: ${s.officialSite}`);
    console.log(`   - Total Producciones Canónicas: ${s.worksCount}`);
    console.log(`   - Calificación Media MAL/AniList: ★ ${s.averageScore}`);
    console.log(`   - Obras Maestras Consagradas (Finalizado): ${dossier?.masterpieces.length}`);
    console.log(`   - Producciones Activas / Próximas: ${dossier?.activeAndUpcoming.length}`);
    console.log(`   - Top 4 Obras Maestras Consagradas:`);
    dossier?.masterpieces.slice(0, 4).forEach((m, idx) => {
      console.log(`       ${idx + 1}. ${m.title} (★ ${m.score}) [${m.status}]`);
    });
    if (dossier?.activeAndUpcoming && dossier.activeAndUpcoming.length > 0) {
      console.log(`   - Producciones Activas / Próximas:`);
      dossier.activeAndUpcoming.forEach((m, idx) => {
        console.log(`       ${idx + 1}. ${m.title} [${m.status}]`);
      });
    }
  }

  const catalog = animeLiveService.getCatalog();
  console.log(`\nTotal Catálogo Global: ${catalog.length} producciones.`);

  const topCritica = animeLiveService.getRanking('all');
  console.log(`Top Crítica Histórica: ${topCritica.data.length} producciones finalizadas.`);
  const topAiring = animeLiveService.getRanking('airing');
  console.log(`Top En Emisión: ${topAiring.data.length} simulcasts activos.`);
}

testStudios();
