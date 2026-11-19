# 猫PRESS v2 — Anime Intelligence & Streaming Wire

Plataforma de inteligencia editorial de anime y manga en tiempo real con arquitectura **Shibuya Stream**, agregador de agencias RSS verificadas, **Radar en Vivo** (X / Bluesky), catálogo canónico de los 10 grandes estudios de animación, calendario semanal de simulcasts (JST) y podio de ranking crítico.

## 🚀 Requisitos

- **Node.js** 20+
- **npm** 9+

## 📦 Instalación y Ejecución

1. Clonar el repositorio e instalar dependencias:
   ```bash
   npm install
   npm --prefix server install
   npm --prefix client install
   ```

2. Configurar variables de entorno en `server/.env` (puedes copiar `server/.env.example`):
   ```bash
   cp server/.env.example server/.env
   ```

3. Iniciar el entorno de desarrollo (Backend en `:3001` + Frontend Vite en `:5173`):
   ```bash
   npm run dev
   ```

4. Compilar para producción:
   ```bash
   npm run build
   ```

## Seguridad y datos locales

Los favoritos se guardan en el navegador y no se sincronizan entre dispositivos. Las antiguas rutas de datos compartidos están desactivadas hasta disponer de autenticación de usuarios.

La sincronización automática continúa en segundo plano. Para usar las rutas administrativas `/api/news/sync` o `/api/radar/ingest`, configura `ADMIN_API_TOKEN` en `server/.env` y envía `Authorization: Bearer <token>`. Sin token, esas rutas están desactivadas. El botón de actualizar consulta los datos disponibles.

El proxy de imágenes solo acepta proveedores conocidos mediante HTTPS, limita el tamaño y solo sigue hasta dos redirecciones entre proveedores permitidos. Si una fuente nueva usa otro dominio, añádelo a la lista de proveedores en `server/src/services/imageProxy.ts` tras verificarlo.

Abre `/admin` para revisar las fuentes y editar la categoría o la visibilidad de las noticias. Para entrar, usa el valor de `ADMIN_API_TOKEN` configurado en el servidor. Usa HTTPS en el despliegue. La clave solo permanece en memoria mientras el panel está abierto. Las decisiones editoriales se guardan en SQLite y puedes deshacerlas con la categoría «Automática» o volviendo a mostrar la noticia. Al retirar una noticia, su enlace directo sigue disponible.

El piloto de Aniplex of America lee el feed público de su canal de YouTube y selecciona tráilers, teasers y anuncios. Su último intento de lectura aparece en el panel.

## Biblioteca de manga y anime

Abre **Biblioteca** desde la barra lateral o visita `/biblioteca`. Las pestañas **Ver anime** y **Leer manga** permiten elegir una fuente y buscar por título.

- **Anime en NekoPress.** En TíoAnime, abre una serie y selecciona el episodio. En JKAnime, escribe el número y pulsa **Ver episodio aquí**. Si un reproductor falla, puedes elegir otro en **Servidor** cuando la fuente publique varias opciones. Kitsu permite buscar el título en TíoAnime y consultar las plataformas de su ficha. La pestaña también incluye un enlace al directorio de AnimeLatinoHD.
- **Manga en NekoPress.** InManga ofrece capítulos en español. En MangaDex puedes elegir español, español latino o inglés y ver qué grupo tradujo cada capítulo si la fuente lo indica. Los capítulos alojados en ambas fuentes se abren en el lector, que recuerda la última página en ese navegador. Los capítulos externos de MangaDex indican su enlace de lectura. Olympus Scanlation permite explorar su catálogo y buscar una edición de la misma obra en InManga.

El catálogo en línea es público. La lectura y la reproducción dependen de la disponibilidad de cada capítulo o episodio en su fuente. Para abrir archivos de tu equipo, selecciona varias imágenes en **Leer manga** o un MP4 o WebM en **Ver anime**. El navegador recuerda la página o el punto de reproducción de tus archivos.

Para compartir una colección con tus amigos:

1. Configura una clave independiente en `BIBLIOTECA_CLAVE` en `server/.env` y reinicia el servidor.
2. Organiza los archivos en el equipo que ejecuta NekoPress con esta estructura:

   ```text
   server/biblioteca/
     manga/
       Nombre del manga/
         Capítulo 1/
           1.jpg
           2.jpg
           10.jpg
     anime/
       Nombre de la serie/
         Episodio 1.mp4
         Episodio 2.webm
   ```

3. Actualiza `/biblioteca`. Las carpetas y páginas se ordenan por nombre y número. El lector admite JPG, PNG, WebP y AVIF. Si tienes un CBZ, extrae las imágenes en la carpeta del capítulo.
4. Tus amigos pueden entrar con la clave desde una dirección de NekoPress accesible para ellos. Para un despliegue en internet usa HTTPS. En producción, la cookie de sesión requiere HTTPS.

La colección compartida está desactivada mientras la clave esté vacía. Los archivos multimedia de esa carpeta quedan fuera de Git. La sesión dura hasta siete días y termina también al reiniciar el servidor. El progreso de lectura y reproducción se guarda en cada navegador.
