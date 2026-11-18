import { defineConfig } from 'vitest/config';

// Tests run against a separate database because they empty the tables between tests.
// test.env is applied before any module loads, and dotenv never overrides an existing
// variable, so this beats the DATABASE_URL in the real env file. ENV_FILE=/dev/null keeps
// the tests from loading real API keys at all.
export default defineConfig({
  test: {
    // TZ is set to a non-UTC zone on purpose so time-zone bugs show up in tests
    env: { DATABASE_URL: 'postgresql://localhost:5432/jobtracker_test', ENV_FILE: '/dev/null', TZ: 'America/New_York' },
    globalSetup: './test/globalSetup.ts',
    fileParallelism: false,
  },
});
