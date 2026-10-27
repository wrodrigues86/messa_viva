import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate', includeAssets: ['logo.svg','icons/icon.svg','offline.html'],
    manifest: { name: 'Mesa Viva — Cardápios Digitais', short_name: 'Mesa Viva', description: 'Cardápios digitais para negócios cheios de sabor.', lang: 'pt-BR', theme_color: '#176b52', background_color: '#f7f8f4', display: 'standalone', start_url: '/', icons: [{ src: '/icons/icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' }, { src: '/icons/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }] },
    workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'], runtimeCaching: [
      { urlPattern: ({ url }) => url.pathname.startsWith('/api/public/'), handler: 'NetworkFirst', options: { cacheName: 'public-menus', expiration: { maxEntries: 50, maxAgeSeconds: 86400 }, cacheableResponse: { statuses: [0, 200] } } },
      { urlPattern: ({ request, url }) => request.destination === 'image' && url.pathname.startsWith('/uploads/'), handler: 'CacheFirst', options: { cacheName: 'menu-images', expiration: { maxEntries: 150, maxAgeSeconds: 604800 } } }
    ] }
  })],
  server: { proxy: { '/api': 'http://localhost:3001', '/uploads': 'http://localhost:3001' } },
  preview: { proxy: { '/api': 'http://localhost:3001', '/uploads': 'http://localhost:3001' } }
});
