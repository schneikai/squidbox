/* eslint-env node, browser */
import { resetMockDataAsync } from '../../../scripts/localBackend.mjs';

// Before the UI flow tests: the mock account reset to exactly the mock data set (what
// `dev:local -- --reset-data` runs).
export default async function globalSetup() {
  await resetMockDataAsync();
}
