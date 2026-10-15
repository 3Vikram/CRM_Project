
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
        target: 'http://192.168.0.52:5000',
        changeOrigin: true,
      },
      '/api/assets': {
        target: 'http://192.168.0.52:5000',
        changeOrigin: true,
      },
      '/api/products': {
        target: 'http://192.168.0.52:5000',
        changeOrigin: true,
      },
      '/api/daily-email': {
        target: 'http://192.168.0.52:5000',
        changeOrigin: true,
      },
      '/api/delivery-challans': {
        target: 'http://192.168.0.52:5000',
        changeOrigin: true,
      },
      '/api/returned-challans': {
        target: 'http://192.168.0.52:5000',
        changeOrigin: true,
      },
      '/api/accessories': {
        target: 'http://192.168.0.52:5000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://192.168.0.52:5001',
        changeOrigin: true,
      },
    },
  },
})
