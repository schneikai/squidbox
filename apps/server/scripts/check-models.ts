/**
 * Checks Venice models for one kind, on demand, with the same checks an ai_admin runs from the app
 * (Settings → Assistant → Writing or Vision → ⋯ → Run check): for writing the chat check
 * (src/ai/chatCheck.ts: fixed conversations, code checks and a judge question per turn), for vision
 * the tagging check (src/ai/tagCheck.ts: four fixed photos, valid tags). Writes every turn to a
 * Markdown report, with per-model pass counts and seconds per turn, for a human to read the replies.
 *
 * Run from apps/server:
 *   npm run check:models -- deepseek-v4-1-flash-uncensored kimi-k3
 *   npm run check:models -- qwen-3-6-plus --scenario talk --out /tmp/qwen.md
 *   npm run check:models -- --kind vision gemma-4-uncensored
 *
 * Calls Venice directly with VENICE_API_KEY (apps/server/.env or the shell), and refuses any other
 * VENICE_BASE_URL. No database, no backend: the app's default instructions. The report goes to
 * .model-checks/ (gitignored) unless --out names a file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiModelKindSchema, resolveInstructions, type AiModelKind, type ModelCheckResult } from '@squidbox/shared';
import { catalogAsync, findModel } from '../src/ai/catalog.js';
import { CHECKS } from '../src/ai/modelCheck.js';

type Args = { kind: AiModelKind; models: string[]; sections: string[] | undefined; out: string | null };

/** The command line: model ids, `--kind writing|vision` (writing), `--scenario <id>`… (writing only), `--out <file>`. */
export function parseArgs(args: string[]): Args {
  const models: string[] = [];
  const scenarios: string[] = [];
  let kind: AiModelKind = 'writing';
  let out: string | null = null;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === '--scenario') scenarios.push(args[++index]!);
    else if (arg === '--out') out = args[++index]!;
    else if (arg === '--kind') kind = aiModelKindSchema.parse(args[++index]);
    else models.push(arg);
  }
  if (scenarios.length > 0 && kind !== 'writing') throw new Error('--scenario is only for --kind writing');
  const known = CHECKS[kind].sectionIds;
  for (const id of scenarios) if (!known.includes(id)) throw new Error(`No scenario ${id} (${known.join(', ')})`);
  return { kind, models, sections: scenarios.length > 0 ? scenarios : undefined, out };
}

const indented = (text: string) => text.replace(/^/gm, '    ');

/** One model's part of the report: each section, its turns with the replies and the checks. */
export function renderModel(modelId: string, result: ModelCheckResult): string[] {
  const lines = [`## ${modelId}`, ''];
  for (const section of result.sections) {
    lines.push(`### ${section.id}: ${section.title}`, '');
    if (section.systemMessage) {
      lines.push(
        '<details><summary>System message</summary>',
        '',
        '```',
        section.systemMessage,
        '```',
        '</details>',
        '',
      );
    }
    for (const turn of section.turns) {
      if (turn.note) lines.push(`*The editor changed the post: ${turn.note}*`, '');
      lines.push(turn.prompt.replace(/^/gm, '> '), '');
      if (turn.error) {
        lines.push(`**Error:** ${turn.error}`, '');
      } else {
        const seconds = turn.seconds === null ? '' : `${turn.seconds.toFixed(1)} s`;
        lines.push(`*${seconds}${turn.unreadable ? ', not the JSON: kept as text' : ''}*`, '');
        if (turn.reply !== null) lines.push(turn.reply ? indented(turn.reply) : '    (no reply text)', '');
        turn.items.forEach((item, index) => lines.push(`${index + 1}. ${item.replace(/\n/g, ' / ')}`));
        if (turn.items.length > 0) lines.push('');
      }
      const checks = turn.checks.map(
        ({ name, ok, reason }) => `${ok ? 'PASS' : '**FAIL**'} ${name}${reason ? ` (${reason})` : ''}`,
      );
      if (checks.length > 0) lines.push(checks.join(' · '), '');
    }
  }
  return lines;
}

async function main() {
  const { kind, models, sections, out } = parseArgs(process.argv.slice(2));
  if (models.length === 0) {
    throw new Error(
      'Usage: npm run check:models -- [--kind writing|vision] <modelId>… [--scenario <id>]… [--out <file.md>]',
    );
  }
  if (!process.env.VENICE_API_KEY) throw new Error('VENICE_API_KEY is not set (apps/server/.env or the shell)');
  const base = process.env.VENICE_BASE_URL ?? 'https://api.venice.ai/api/v1';
  if (!base.startsWith('https://api.venice.ai/')) throw new Error(`Not Venice: ${base}`);

  const { entries } = await catalogAsync();
  const instructions = resolveInstructions(null);
  const results: { id: string; result: ModelCheckResult }[] = [];
  for (const id of models) {
    const found = findModel(entries, id, kind);
    if ('error' in found) {
      console.error(`${id}: ${found.error}`);
      continue;
    }
    console.log(`${id}…`);
    const result = await CHECKS[kind].run(found.entry, { catalog: entries, instructions, sectionIds: sections });
    console.log(`${id}: ${result.passes} passed, ${result.fails} failed, ${result.unreadable} not JSON`);
    results.push({ id, result });
  }

  const startedAt = new Date().toISOString();
  const report = [
    `# ${kind === 'writing' ? 'Chat' : 'Tagging'} model check, ${startedAt}`,
    '',
    kind === 'writing'
      ? `Scenarios: ${(sections ?? CHECKS.writing.sectionIds).join(', ')}. The default briefing, the mock creator, the server's chat task, judged per turn.`
      : "The four check photos, the default Photo tags briefing with the mock creator's themes, the server's tagging task.",
    '',
    '| Model | Passed | Failed | Not JSON | Median s/turn | Slowest turn |',
    '|---|---|---|---|---|---|',
    ...results.map(
      ({ id, result }) =>
        `| ${id} | ${result.passes} | ${result.fails} | ${result.unreadable} | ${result.medianSeconds.toFixed(1)} | ${result.slowestSeconds.toFixed(1)} |`,
    ),
    '',
    ...results.flatMap(({ id, result }) => renderModel(id, result)),
  ].join('\n');
  const file =
    out ??
    join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '.model-checks',
      `${kind}-${startedAt.replace(/[:.]/g, '-')}.md`,
    );
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${report}\n`);
  console.log(`Report: ${file}`);
}

// Only as the command: the tests import parseArgs and renderModel.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
