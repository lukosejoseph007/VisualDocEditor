import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',               // project root
  base: './',              // relative paths
  build: {
    outDir: 'dist',        // output folder
    emptyOutDir: true
  }
});