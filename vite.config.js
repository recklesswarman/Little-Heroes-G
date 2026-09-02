import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Little-Heroes-G/',
  server: {
    port: 5173,
    host: true,
    open: false
  }
});
