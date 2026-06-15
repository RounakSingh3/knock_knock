import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk: React + Router
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase in its own chunk
          'vendor-supabase': ['@supabase/supabase-js'],
          // Lucide icons
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    // Increase chunk size limit since we are now splitting
    chunkSizeWarningLimit: 300,
    // Target modern browsers for smaller output
    target: 'es2020',
    // Enable CSS code splitting
    cssCodeSplit: true,
  },
});
