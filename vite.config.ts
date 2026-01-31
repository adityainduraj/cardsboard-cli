import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Custom plugin to handle multi-entry HTML files in dev mode
function multiEntryPlugin() {
  return {
    name: 'multi-entry',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // Rewrite /sketch-editor to /sketch-editor.html
        if (req.url === '/sketch-editor' || req.url === '/sketch-editor/') {
          req.url = '/sketch-editor.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), multiEntryPlugin()],
  root: 'src/canvas',
  build: {
    outDir: '../../dist/canvas',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './src/canvas/index.html',
        'sketch-editor': './src/canvas/sketch-editor.html',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/canvas'),
      '@canvas': path.resolve(__dirname, './src/canvas'),
      '@server': path.resolve(__dirname, './src/server'),
      '@scanner': path.resolve(__dirname, './src/scanner'),
    },
  },
  server: {
    port: 3002,
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  // Expose env vars to client - need VITE_ prefix
  // Note: OPENROUTER_API_KEY is NOT embedded here - it's managed by the user in the UI
  define: {
    'process.env.OPENROUTER_SITE_URL': JSON.stringify(process.env.OPENROUTER_SITE_URL || 'https://cardsboard.app'),
    'process.env.OPENROUTER_APP_NAME': JSON.stringify(process.env.OPENROUTER_APP_NAME || 'Cardsboard'),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
})

