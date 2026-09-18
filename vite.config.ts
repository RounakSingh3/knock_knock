import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Vite plugin to fix the __vite__mapDeps TDZ (Temporal Dead Zone) bug.
 * 
 * Vite 5.x generates self-referencing default parameter on a `const` declaration in dynamic import wrappers:
 *   const __vite__mapDeps=(i,m=__vite__mapDeps,d=(...))=>i.map(i=>d[i]);
 * 
 * Rewriting `const __vite__mapDeps=` to `var __vite__mapDeps=` resolves this cleanly.
 * NOTE: Replacing ALL `const`/`let` with `var` across minified bundles is dangerous because
 * minifiers intentionally reuse variable names across block scopes within the same function,
 * which causes function-scoped variable collision (e.g. "T is not iterable").
 */
function fixViteMapDepsTDZ(): Plugin {
  return {
    name: 'fix-vite-mapdeps-tdz',
    enforce: 'post',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist', 'assets');
      if (!existsSync(distDir)) {
        return;
      }

      const files = readdirSync(distDir).filter(f => f.endsWith('.js'));
      let patchCount = 0;
      for (const file of files) {
        const filePath = join(distDir, file);
        let code = readFileSync(filePath, 'utf-8');
        if (code.includes('__vite__mapDeps')) {
          const patched = code.replace(
            /\bconst\s+__vite__mapDeps\s*=/,
            'var __vite__mapDeps='
          );
          if (patched !== code) {
            writeFileSync(filePath, patched, 'utf-8');
            patchCount++;
          }
        }
      }
      if (patchCount > 0) {
        process.stdout.write(`[fix-vite-mapdeps-tdz] Patched ${patchCount} files\n`);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    fixViteMapDepsTDZ(),
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
