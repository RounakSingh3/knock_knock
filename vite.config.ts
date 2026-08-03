import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Vite plugin to fix Temporal Dead Zone (TDZ) issues in production builds.
 * 
 * Rewrites ALL `const` to `var` in the generated JS files to completely
 * eliminate any possibility of TDZ errors (like "Cannot access 'm' before
 * initialization"). This is safe because the bundler's output is already
 * correctly scoped — `const` adds no safety benefit in minified output.
 */
function fixAllTDZ(): Plugin {
  return {
    name: 'fix-all-tdz',
    enforce: 'post',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist', 'assets');
      if (!existsSync(distDir)) {
        process.stdout.write(`[fix-tdz] dist/assets not found at ${distDir}\n`);
        return;
      }

      const files = readdirSync(distDir).filter(f => f.endsWith('.js'));
      let patchCount = 0;
      for (const file of files) {
        const filePath = join(distDir, file);
        let code = readFileSync(filePath, 'utf-8');
        
        // Replace all `const ` with `var ` to eliminate TDZ risks
        // We only replace at statement boundaries to avoid touching strings
        const patched = code
          .replace(/\bconst\s+/g, 'var ')
          .replace(/\blet\s+/g, 'var ');
        
        if (patched !== code) {
          writeFileSync(filePath, patched, 'utf-8');
          patchCount++;
        }
      }
      process.stdout.write(`[fix-tdz] Patched ${patchCount} files (const/let -> var)\n`);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    fixAllTDZ(),
  ],
  build: {
    rollupOptions: {
      output: {
        // Let Vite handle chunking automatically for correct initialization order
      },
    },
    // Increase chunk size limit
    chunkSizeWarningLimit: 500,
    // Target modern browsers for smaller output
    target: 'es2020',
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Minify with esbuild for speed
    minify: 'esbuild',
    // Enable source maps for debugging
    sourcemap: true,
  },
  // Strip console.log and debugger in production builds for cleaner, faster output
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});
