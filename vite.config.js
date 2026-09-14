import { defineConfig } from 'vite';
import { sites } from '@openai/sites-vite-plugin';
export default defineConfig({
  plugins: [sites()],
  build: {
    ssr: 'src/worker.js', outDir: 'dist/server', emptyOutDir: true,
    rollupOptions: {output: {entryFileNames:'index.js', inlineDynamicImports:true}},
  },
  ssr: {noExternal: true},
});
