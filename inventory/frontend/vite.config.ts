
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
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
    proxy: {
      '/api/accounts': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
      },
      '/uploads/products': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/uploads/documents': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
      '/api/inventory': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api/assets': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api/products': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api/daily-email': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api/delivery-challans': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api/returned-challans': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api/accessories': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api/suppliers': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
      '/api/customers/inventory-options': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
    },
  },
})
