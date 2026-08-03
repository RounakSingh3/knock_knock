import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

/**
 * Vite plugin to fix the __vite__mapDeps TDZ (Temporal Dead Zone) bug.
 *
 * Vite 5.x generates this pattern in the entry chunk:
 *   const __vite__mapDeps=(i,m=__vite__mapDeps,d=(...))=>i.map(i=>d[i]);
 *
 * This is a self-referencing default parameter on a `const` declaration,
 * which causes "Cannot access 'm' before initialization" on some JS engines
 * (the variable is in TDZ during its own initializer, per the ES spec).
 *
 * The fix rewrites `const __vite__mapDeps=` to `var __vite__mapDeps=`,
 * which avoids TDZ because `var` is hoisted with an `undefined` initial value.
 *
 * We use `closeBundle` hook since Vite injects __vite__mapDeps AFTER all
 * Rollup hooks but BEFORE writing to disk — so we patch files post-write.
 */
function fixViteMapDepsTDZ(): Plugin {
  return {
    name: 'fix-vite-mapdeps-tdz',
    enforce: 'post',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist', 'assets');
      if (!fs.existsSync(distDir)) return;

      const files = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));
      for (const file of files) {
        const filePath = path.join(distDir, file);
        let code = fs.readFileSync(filePath, 'utf-8');
        if (code.includes('__vite__mapDeps')) {
          const patched = code.replace(
            /\bconst\s+__vite__mapDeps\s*=/,
            'var __vite__mapDeps='
          );
          if (patched !== code) {
            fs.writeFileSync(filePath, patched, 'utf-8');
            // Use process.stdout to avoid being stripped by esbuild drop
            process.stdout.write(`[fix-vite-mapdeps-tdz] Patched TDZ issue in ${file}\n`);
          }
        }
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
  },
  // Strip console.log and debugger in production builds for cleaner, faster output
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});
