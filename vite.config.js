import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true },
  build: {
    rollupOptions: {
      output: {
        // Keep the charting library in its own cacheable chunk.
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], charts: ['recharts'] },
      },
    },
  },
});
