import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Memory-optimized configuration for high-memory tests
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Force sequential execution
        isolate: true,
        minThreads: 1,
        maxThreads: 1
      }
    },
    maxConcurrency: 1, // No parallelism at all
    testTimeout: 60000, // Longer timeout for sequential execution
    hookTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: [
        'node_modules/',
        'src/test/',
        'dist/',
        '*.config.*',
        '**/*.d.ts'
      ]
    },
    include: [
      // High-memory test patterns
      'src/test/integration/bittorrent-chunking.test.ts',
      'src/test/integration/end-to-end.integration.test.ts',
      'src/test/contract/media-cache-persistence.test.ts',
      'src/test/contract/ofdm-media-transport.test.ts',
      'src/lib/ham-server/ham-server.test.ts',
      'src/lib/waterfall-snr/waterfall.test.ts',
      'src/lib/qpsk-modem/*.test.ts'
    ],
    exclude: [
      'node_modules/',
      'dist/',
      'src/test/setup.ts'
    ]
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@lib': resolve(__dirname, './src/lib'),
      '@pages': resolve(__dirname, './src/pages'),
      '@types': resolve(__dirname, './src/types')
    }
  }
});