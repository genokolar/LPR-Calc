import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  // base 路径：GitHub Actions 通过环境变量传入，默认使用相对路径
  base: process.env.VITE_BASE_PATH || './',
  plugins: [inspectAttr(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // 构建配置
  build: {
    // 输出目录
    outDir: 'dist',
    // 代码压缩
    minify: 'esbuild',
    // 分块策略
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 React 相关库打包到单独的 chunk
          'vendor-react': ['react', 'react-dom'],
          // 将 UI 组件库打包到单独的 chunk
          'vendor-ui': [
            '@radix-ui/react-tabs',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-dialog',
            '@radix-ui/react-popover',
          ],
          // 将工具库打包到单独的 chunk
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
});
