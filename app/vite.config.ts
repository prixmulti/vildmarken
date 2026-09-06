import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/vildmarken/app/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/vildmarken/api': {
            target: 'http://localhost:8080',
            changeOrigin: true,
            rewrite: (requestPath) => requestPath.replace(/^\/vildmarken/, ''),
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
