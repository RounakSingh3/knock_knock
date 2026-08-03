import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Removed custom manualChunks as they can cause chunk loading initialization issues
        // (Temporal Dead Zone errors like "Cannot access 'm' before initialization")
      },
    },
    // Increase chunk size limit since we are no longer splitting strictly
    chunkSizeWarningLimit: 300,
    // Target modern browsers for smaller output
    target: 'es2020',
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Minify with esbuild for speed
    minify: 'esbuild',
  },
  // Strip console.log and debugger in production builds for cleaner, faster output
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});
