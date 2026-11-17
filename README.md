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
