/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  build: { sourcemap: true },
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react", "exceljs"],
  },
  build: {
    // Suppress chunk size warnings (we're splitting deliberately)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core (~150KB) — cached permanently
          "vendor-react": [
            "react",
            "react-dom",
            "react-router-dom",
          ],
          // Charts (~200KB) — only needed on analytics pages
          "vendor-charts": [
            "chart.js",
            "react-chartjs-2",
            "chartjs-plugin-datalabels",
          ],
          // Excel/XLSX (~800KB) — only needed for export
          "vendor-xlsx": [
            "xlsx",
            "xlsx-js-style",
          ],
          // Maps (~150KB) — only needed on map views
          "vendor-maps": [
            "leaflet",
            "react-leaflet",
          ],
          // Utility libraries (~80KB)
          "vendor-utils": [
            "date-fns",
            "clsx",
            "jwt-decode",
            "pako",
            "jszip",
            "socket.io-client",
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
