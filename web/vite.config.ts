import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        play: resolve(import.meta.dirname, "play.html"),
      },
    },
  },
  server: { fs: { allow: [".."] } },
});
