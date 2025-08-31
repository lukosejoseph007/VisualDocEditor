import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: '.',               // project root
  base: './',              // relative paths
  plugins: [react()],
  build: {
    outDir: 'dist',        // output folder
    emptyOutDir: true
  }
});
