import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // postgres.js connects lazily; this lets getDb() construct without a real DB
    // for unit tests that inject their own deps and never run a query.
    env: { DATABASE_URL: 'postgres://news:news@localhost:5433/news' },
  },
});
