import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
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
  base: '/The-Smurf/',
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
          // React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react';
          }
          // Firebase — large, rarely changes
          if (id.includes('node_modules/firebase/')) {
            return 'vendor-firebase';
          }
          // HLS.js — heavy video library, loaded only in Watch page
          if (id.includes('node_modules/hls.js/')) {
            return 'vendor-hls';
          }
          // React icons — medium sized, shared
          if (id.includes('node_modules/react-icons/')) {
            return 'vendor-icons';
          }
          // Other node_modules
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
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
})

