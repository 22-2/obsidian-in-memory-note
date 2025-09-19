import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom', // or 'happy-dom' for faster DOM emulation
  },
  resolve: {
    alias: {
      'obsidian': path.resolve(__dirname, './src/tests/obsidian.ts'),
      'src': path.resolve(__dirname, './src'),
    },
  },
});
