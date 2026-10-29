/**
 * Verifies Venice models for one kind, on demand, as an ai_admin does from the app (Settings →
 * Assistant → Writing or Vision → the model → Verify): for writing src/ai/chatVerify.ts (fixed
 * conversations, code checks and a judge question per turn), for vision src/ai/tagVerify.ts (four
 * fixed photos, valid tags). Writes every turn to a
 * Markdown report, with per-model pass counts and seconds per turn, for a human to read the replies.
 *
 * Run from apps/server:
 *   npm run verify:models -- deepseek-v4-1-flash-uncensored kimi-k3
 *   npm run verify:models -- qwen-3-6-plus --scenario talk --out /tmp/qwen.md
 *   npm run verify:models -- --kind vision gemma-4-uncensored
 *
 * Calls Venice directly with VENICE_API_KEY (apps/server/.env or the shell), and refuses any other
 * VENICE_BASE_URL. No database, no backend: the app's default instructions. The report goes to
 * .model-verify/ (gitignored) unless --out names a file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aiModelKindSchema,
  resolveInstructions,
  verifyPlanTurns,
  type AiModelKind,
  type VerifyResult,
} from '@squidbox/shared';
import { catalogAsync, findModel } from '../src/ai/catalog.js';
import { VERIFY } from '../src/ai/verify.js';
import { VerifyStopped } from '../src/ai/verifyTurns.js';

// The ids of the kind's sections, the --scenario candidates.
const known = (kind: AiModelKind) => VERIFY[kind].plan.sections.map((section) => section.id);

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
  const ids = known(kind);
  for (const id of scenarios) if (!ids.includes(id)) throw new Error(`No scenario ${id} (${ids.join(', ')})`);
  return { kind, models, sections: scenarios.length > 0 ? scenarios : undefined, out };
}

const indented = (text: string) => text.replace(/^/gm, '    ');

/** One model's part of the report: each section, its turns with the replies and the checks. */
export function renderModel(modelId: string, result: VerifyResult, stopped: string | null = null): string[] {
  const lines = [`## ${modelId}`, ''];
  if (stopped) lines.push(`**Stopped:** ${stopped}`, '');
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
      if (turn.note) lines.push(`*${turn.note}*`, '');
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
      'Usage: npm run verify:models -- [--kind writing|vision] <modelId>… [--scenario <id>]… [--out <file.md>]',
    );
  }
  if (!process.env.VENICE_API_KEY) throw new Error('VENICE_API_KEY is not set (apps/server/.env or the shell)');
  const base = process.env.VENICE_BASE_URL ?? 'https://api.venice.ai/api/v1';
  if (!base.startsWith('https://api.venice.ai/')) throw new Error(`Not Venice: ${base}`);

  const { entries } = await catalogAsync();
  const instructions = resolveInstructions(null);
  const results: { id: string; result: VerifyResult; stopped: string | null }[] = [];
  // The turns of the sections that run (--scenario), all without one.
  const { plan } = VERIFY[kind];
  const total = verifyPlanTurns(
    sections ? { sections: plan.sections.filter((section) => sections.includes(section.id)) } : plan,
  );
  for (const id of models) {
    const found = findModel(entries, id, kind);
    if ('error' in found) {
      console.error(`${id}: ${found.error}`);
      continue;
    }
    console.log(`${id}…`);
    let run: { result: VerifyResult; stopped: string | null };
    try {
      run = {
        result: await VERIFY[kind].run(found.entry, { catalog: entries, instructions, sectionIds: sections }),
        stopped: null,
      };
    } catch (error) {
      if (!(error instanceof VerifyStopped)) throw error;
      run = { result: error.result, stopped: error.message };
    }
    const { result, stopped } = run;
    if (stopped) {
      const turns = result.sections.reduce((sum, section) => sum + section.turns.length, 0);
      console.log(`${id}: stopped at turn ${turns + 1} of ${total}: ${stopped}`);
    }
    console.log(`${id}: ${result.passes} passed, ${result.fails} failed, ${result.unreadable} not JSON`);
    results.push({ id, ...run });
  }

  const startedAt = new Date().toISOString();
  const report = [
    `# ${kind === 'writing' ? 'Writing' : 'Vision'} Verify report, ${startedAt}`,
    '',
    kind === 'writing'
      ? `Scenarios: ${(sections ?? known(kind)).join(', ')}. The default briefing, the mock creator, the server's chat task, judged per turn.`
      : "The four Verify photos, the default Photo tags briefing with the mock creator's themes, the server's tagging task.",
    '',
    '| Model | Passed | Failed | Not JSON | Median s/turn | Slowest turn |',
    '|---|---|---|---|---|---|',
    ...results.map(
      ({ id, result }) =>
        `| ${id} | ${result.passes} | ${result.fails} | ${result.unreadable} | ${result.medianSeconds.toFixed(1)} | ${result.slowestSeconds.toFixed(1)} |`,
    ),
    '',
    ...results.flatMap(({ id, result, stopped }) => renderModel(id, result, stopped)),
  ].join('\n');
  const file =
    out ??
    join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '.model-verify',
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
