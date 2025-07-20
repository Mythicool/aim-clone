import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          socket: ['socket.io-client'],
        },
      },
    },
  },
  define: {
    // Replace environment variables at build time
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || 'http://localhost:3001'),
    __SOCKET_URL__: JSON.stringify(process.env.VITE_SOCKET_URL || 'http://localhost:3001'),
  },
})