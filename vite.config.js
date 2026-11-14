import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// base './' membuat website bisa jalan di GitHub Pages (https://user.github.io/nama-repo/)
// Dua halaman: leaderboard publik (/) dan dashboard admin (/admin/).
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
      },
    },
  },
});
