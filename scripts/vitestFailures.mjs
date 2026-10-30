import { BasicReporter } from 'vitest/reporters';

/**
 * The vitest reporter of `npm run check`: only the failed tests and suites, with their errors and
 * diffs. No banner, no line per file, no test console output, no totals.
 */
export default class FailuresReporter extends BasicReporter {
  onInit(ctx) {
    this.ctx = ctx;
    this.start = performance.now();
  }

  onTaskUpdate() {}

  onUserConsoleLog() {}

  reportSummary(files, errors) {
    this.printErrorsSummary(files, errors);
  }
}
