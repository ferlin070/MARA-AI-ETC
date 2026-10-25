import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const uiDir = path.resolve(__dirname, '../../packages/openhands-ui');
const localModules = path.resolve(__dirname, 'node_modules');

/**
 * Vendor chunk split (PLAN 3.6).
 *
 * Before this the app shipped one ~3.9 MB bundle. Framework code is now split
 * so it caches independently of MARA's own screens:
 *   vendor-react    react, react-dom, scheduler
 *   vendor-router   react-router (+ @remix-run internals)
 *   vendor-oidc     oidc-client-ts — only touched during the SSO round-trip
 *   vendor-ui       @openhands/ui and its runtime deps
 *   vendor-icons-N  react-bootstrap-icons, hashed into even buckets
 *   vendor          everything else from node_modules
 * App code stays in the entry chunk (`index`).
 *
 * Why the icon buckets: `@openhands/ui`'s Icon does
 *   import * as icons from "react-bootstrap-icons"
 * and resolves the component by string key, which defeats tree-shaking — the
 * entire icon set (3.4 MB minified) lands in the bundle. That import lives in
 * packages/openhands-ui, which this app consumes read-only. So the choice here
 * is to spread the payload over even chunks instead of shipping one 3.4 MB
 * file. The real fix (explicit icon registry instead of a namespace import)
 * belongs to the platform team; noted in the commit message.
 *
 * Bucketing is a hash of the icon file name, not a letter range, because the
 * icon set is unevenly distributed by letter (a-d alone is 1.2 MB).
 */
const ICON_CHUNKS = 10;

function hashBucket(name: string, buckets: number): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h + name.charCodeAt(i)) >>> 0;
  }
  return h % buckets;
}

function manualChunks(id: string): string | undefined {
  const normalized = id.replace(/\\/g, '/');
  const isUiPackage = normalized.includes('/packages/openhands-ui/');

  if (!normalized.includes('/node_modules/') && !isUiPackage) return undefined;

  if (normalized.includes('/react-bootstrap-icons/')) {
    const iconFile = normalized.split('/react-bootstrap-icons/')[1] ?? '';
    // Barrel/prop-types shims are tiny — pin them to bucket 0.
    if (!iconFile.startsWith('dist/icons/')) return 'vendor-icons-00';
    const base = iconFile.replace(/^dist\/icons\//, '').replace(/\.js$/, '');
    return `vendor-icons-${String(hashBucket(base, ICON_CHUNKS)).padStart(2, '0')}`;
  }
  if (normalized.includes('/oidc-client-ts/')) return 'vendor-oidc';
  if (
    normalized.includes('/react-router/') ||
    normalized.includes('/@remix-run/')
  ) {
    return 'vendor-router';
  }
  if (
    normalized.includes('/node_modules/react/') ||
    normalized.includes('/node_modules/react-dom/') ||
    normalized.includes('/node_modules/scheduler/')
  ) {
    return 'vendor-react';
  }
  if (
    isUiPackage ||
    normalized.includes('/node_modules/@floating-ui/') ||
    normalized.includes('/node_modules/focus-trap') ||
    normalized.includes('/node_modules/react-select/') ||
    normalized.includes('/node_modules/tailwind-merge/') ||
    normalized.includes('/node_modules/clsx/') ||
    normalized.includes('/node_modules/sonner/') ||
    normalized.includes('/node_modules/deep-equal/')
  ) {
    return 'vendor-ui';
  }
  return 'vendor';
}

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  resolve: {
    alias: [
      { find: '@openhands/ui', replacement: path.join(uiDir, 'index.ts') },
      { find: 'tailwind-merge', replacement: path.join(localModules, 'tailwind-merge') },
      { find: 'clsx', replacement: path.join(localModules, 'clsx') },
      { find: 'react-bootstrap-icons', replacement: path.join(localModules, 'react-bootstrap-icons') },
      { find: '@floating-ui/react', replacement: path.join(localModules, '@floating-ui/react') },
      { find: 'deep-equal', replacement: path.join(localModules, 'deep-equal') },
      { find: 'focus-trap-react', replacement: path.join(localModules, 'focus-trap-react') },
      { find: 'react-select', replacement: path.join(localModules, 'react-select') },
      { find: 'sonner', replacement: path.join(localModules, 'sonner') },
      { find: 'tailwind-scrollbar', replacement: path.join(localModules, 'tailwind-scrollbar') },
      { find: 'react', replacement: path.join(localModules, 'react') },
      { find: 'react-dom', replacement: path.join(localModules, 'react-dom') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // Hard ceiling from PLAN.md 3.6: no single chunk over 500 kB minified.
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 4000,
    strictPort: true,
    allowedHosts: true,
    fs: {
      allow: ['../..'],
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_GATEWAY_URL || 'http://localhost:8051',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api(?!\/v1)/, ''),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_GATEWAY_URL || 'http://localhost:8051',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api(?!\/v1)/, ''),
      },
    },
  },
});

