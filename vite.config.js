import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isAndroid = process.env.VITE_PLATFORM === 'android';
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: true,
    },
    base: isAndroid ? '/' : '/The-Smurf/',
    build: {
      outDir: 'dist',
      sourcemap: false,
      cssCodeSplit: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 600,
      // Strip console.log in production
      minify: 'esbuild',
      target: 'es2015',
      rollupOptions: {
        output: {
          // Fine-grained chunk splitting for better caching & smaller initial load
          manualChunks(id) {
            // HLS.js — heavy video library, keep separate for lazy loading
            if (id.includes('node_modules/hls.js/')) {
              return 'vendor-hls';
            }
            // All other node_modules go into a single vendor chunk
            // to avoid React createContext load-ordering errors
            if (id.includes('node_modules/')) {
              return 'vendor';
            }
          },
          // Content-hash filenames for long-term cache
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    // Optimize deps pre-bundling
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
      exclude: ['hls.js'],
    },
  };
});

