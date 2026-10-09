import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The unit files print their own per-assertion report; keep the vitest summary readable
    reporters: ['default'],
    testTimeout: 60_000,
  },
});
