import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The Azure Functions app in api/ has its own package.json and test run
    // (npm test --prefix api) — without this it'd otherwise get picked up
    // twice, once from each project's `vitest run`.
    exclude: ['**/node_modules/**', 'api/**'],
  },
});
