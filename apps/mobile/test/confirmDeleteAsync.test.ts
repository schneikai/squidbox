import { readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Button = { text: string; style?: string; onPress?: () => void };
const alert = vi.fn<(title: string, message: string, buttons: Button[]) => void>();
vi.mock('react-native', () => ({ Alert: { alert: (...args: [string, string, Button[]]) => alert(...args) } }));

const { default: confirmDeleteAsync } = await import('../src/utils/confirmDeleteAsync');

const srcDir = new URL('../src/', import.meta.url);
const sources = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
  .filter((file) => /\.tsx?$/.test(file) && file !== 'utils/confirmDeleteAsync.ts')
  .map((file) => ({ file, text: readFileSync(new URL(file, srcDir), 'utf8') }));

describe('confirmDeleteAsync', () => {
  beforeEach(() => alert.mockReset());

  it('asks "Delete <name>?" with Cancel and a red Delete, and answers what the user chose', async () => {
    const pressed = (text: string) => alert.mock.calls.at(-1)![2].find((button) => button.text === text)!.onPress!();

    const cancelled = confirmDeleteAsync({ name: 'this rule', also: 'It goes from every device.' });
    expect(alert).toHaveBeenCalledWith(
      'Delete this rule?',
      'It goes from every device.',
      [expect.objectContaining({ text: 'Cancel' }), expect.objectContaining({ text: 'Delete', style: 'destructive' })],
      expect.any(Object),
    );
    pressed('Cancel');
    await expect(cancelled).resolves.toBe(false);

    const confirmed = confirmDeleteAsync({ name: '3 items' });
    pressed('Delete');
    await expect(confirmed).resolves.toBe(true);
  });

  // One shape for every delete confirm: a hand-written one drifts in title, action and message.
  it('is the only place that writes a Delete confirm', () => {
    const handWritten = sources
      .filter(({ text }) => /title: ['`]Delete|action: ['`]Delete/.test(text))
      .map(({ file }) => file);
    expect(handWritten).toEqual([]);
  });
});
