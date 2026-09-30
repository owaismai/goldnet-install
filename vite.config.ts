import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH is the URL path the app is served from:
//   GitHub Pages project site  -> "/<repository-name>/"  (set by the deploy workflow)
//   custom domain / local dev  -> "/"                    (the default)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  let base = process.env.BASE_PATH ?? env.BASE_PATH ?? '/';
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
        manifest: {
          name: 'GOLDNET Installation Form',
          short_name: 'GOLDNET Install',
          description: 'Technician installation form with barcode scanning',
          theme_color: '#0f766e',
          background_color: '#f3f4f6',
          display: 'standalone',
          orientation: 'portrait',
          // Relative so it works under /<repo>/ and on a custom domain alike.
          start_url: '.',
          scope: '.',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          navigateFallback: 'index.html',
        },
      }),
    ],
    build: { target: 'es2020', chunkSizeWarningLimit: 700 },
  };
});
