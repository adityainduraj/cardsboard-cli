/**
 * Vite configuration for component preview server
 * This is a separate Vite instance that runs on port 3003
 * It renders AI-generated React components in iframes
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  // Root is the .cardsboard directory
  root: ".cardsboard",

  build: {
    outDir: ".cardsboard/dist",
    emptyOutDir: true,
    sourcemap: true,
  },

  resolve: {
    alias: {
      // Point to the USER's project src
      "@": path.resolve(process.cwd(), "./src"),
      // Point to generated components
      "@cardsboard/generated": path.resolve(process.cwd(), "./.cardsboard/generated"),
    },
  },

  server: {
    port: 3003,
    strictPort: false,
    hmr: {
      protocol: "ws",
      host: "localhost",
    },
  },

  // Optimize for preview rendering
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
});
