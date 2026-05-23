import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  build: {
    lib: {
      entry: 'src/main.jsx',
      name: 'FlowScriptReactBundle',
      fileName: 'index',
      formats: ['iife']
    },
    rollupOptions: {
      input: 'src/main.jsx',
      output: {
        globals: {
          react: 'React',
          'react-dom/client': 'ReactDOM'
        }
      }
    },
    emptyOutDir: true
  }
})
