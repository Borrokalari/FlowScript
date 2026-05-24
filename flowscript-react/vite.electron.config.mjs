import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

// VS Code sets ELECTRON_RUN_AS_NODE=1 for its own Node extensions.
// Clearing it here so spawned Electron children run as a real Electron app.
delete process.env.ELECTRON_RUN_AS_NODE;

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.mjs',
        vite: {
          build: {
            rollupOptions: {
              output: { format: 'cjs' },
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.cjs',
        vite: {
          build: {
            rollupOptions: {
              output: { format: 'cjs' },
            },
          },
        },
      },
    }),
  ],
  base: './',
});
