import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        'src/index.ts',
        'src/cli.ts',
        'src/types.ts',
        'src/server/tools/test-helpers.ts',
      ],
      // `pinecone-client.ts` is large and I/O-heavy; it is covered by dedicated
      // unit tests but not to saturation — thresholds reflect the rest of src/.
      thresholds: {
        lines: 77,
        statements: 76,
        functions: 75,
        branches: 58,
      },
    },
  },
});
