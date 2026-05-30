import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // SSE 请求：禁用缓冲和压缩，确保事件及时推送
            if (req.url?.includes('/events')) {
              proxyReq.setHeader('Accept', 'text/event-stream');
              proxyReq.setHeader('Cache-Control', 'no-cache');
            }
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // SSE 端点强制修正 Content-Type，防止后端返回 text/plain 等非标准 MIME
            // 导致浏览器 EventSource 直接拒绝连接
            if (req.url?.includes('/events')) {
              res.setHeader('Content-Type', 'text/event-stream');
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('X-Accel-Buffering', 'no');
              res.setHeader('Connection', 'keep-alive');
              res.flushHeaders();
            }
          });
        }
      }
    }
  }
})
