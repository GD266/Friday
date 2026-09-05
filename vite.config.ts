import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tauri expects a fixed dev-server port (see src-tauri/tauri.conf.json).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Rust build artifacts must never be file-watched: locking .dll/.exe
      // files mid-compile crashes the dev server on Windows.
      ignored: ["**/src-tauri/**", "**/dist/**"],
    },
  },
  build: {
    target: "es2022",
  },
});
