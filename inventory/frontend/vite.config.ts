
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api/inventory': {
        target: 'http://0.0.0.0:5000',
        changeOrigin: true,
        secure: false,
      },
      '/api/assets': {
        target: 'http://0.0.0.0:5000',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://0.0.0.0:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})