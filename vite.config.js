import { defineConfig } from 'vite';

// Project Pages at https://cmyklisa.github.io/edu-platform/
// 所有 asset URL 都會以這個 base 為前綴。
export default defineConfig({
  base: '/edu-platform/',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
