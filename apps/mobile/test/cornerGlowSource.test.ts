import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// The dev client's inline glow must stay the bundled PNG a release build loads.
test('the inline corner glow is assets/corner-glow.png', () => {
  const source = readFileSync(new URL('../src/features/asset-list/cornerGlowSource.js', import.meta.url), 'utf8');
  const inline = source.match(/data:image\/png;base64,([^']+)/)?.[1] ?? '';
  const png = readFileSync(new URL('../assets/corner-glow.png', import.meta.url));
  expect(Buffer.from(inline, 'base64').equals(png)).toBe(true);
});
