import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { apiDevMiddleware } from "./vite-plugins/api-dev-middleware";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        // This will transform your SVG to a React component
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
    apiDevMiddleware(),
  ],
  server: {
    watch: {
      // Bind mounts en Docker Desktop (Windows/Mac) no siempre propagan eventos
      // inotify entre el host y el container; con polling, chokidar detecta
      // los cambios igual. Se activa solo dentro del container dev (ver
      // docker-compose.dev.yml), no afecta a `npm run dev` en el host.
      usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
    },
  },
});
