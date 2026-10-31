import { BasicReporter } from 'vitest/reporters';

/**
 * The vitest reporter of `npm run check`: only the failed tests and suites, each with what it
 * logged (a fuzz case's seed and steps, say), then their errors and diffs. No banner, no line per
 * file, no totals, and nothing a passing test logged.
 */
export default class FailuresReporter extends BasicReporter {
  logs = [];

  onInit(ctx) {
    this.ctx = ctx;
    this.start = performance.now();
  }

  onTaskUpdate() {}

  onUserConsoleLog(log) {
    this.logs.push(log);
  }

  reportSummary(files, errors) {
    for (const log of this.logs) {
      const task = log.taskId ? this.ctx.state.idMap.get(log.taskId) : undefined;
      if (task?.result?.state !== 'fail') continue;
      const where =
        'filepath' in task ? this.relative(task.filepath) : `${this.relative(task.file.filepath)} > ${task.name}`;
      this.log(`${log.type} | ${where}\n${log.content}`);
    }
    this.printErrorsSummary(files, errors);
  }
}
