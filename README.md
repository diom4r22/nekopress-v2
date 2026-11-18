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

El proxy de imágenes solo acepta proveedores conocidos mediante HTTPS, limita el tamaño y no sigue redirecciones. Si una fuente nueva usa otro dominio, añádelo a la lista de proveedores en `server/src/services/imageProxy.ts` tras verificarlo.
