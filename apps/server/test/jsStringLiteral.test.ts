import { describe, expect, it } from 'vitest';
import { decodeJsStringLiteral } from '../src/contacts/jsStringLiteral.js';

describe('decodeJsStringLiteral', () => {
  it.each([
    [String.raw`say \"hi\"`, 'say "hi"'],
    [String.raw`Maya\'s`, "Maya's"],
    [String.raw`a\\b`, 'a\\b'],
    [String.raw`https:\/\/x.com`, 'https://x.com'],
    [String.raw`one\ntwo\rthree\tfour\bfive\fsix`, 'one\ntwo\rthree\tfour\bfive\fsix'],
    [String.raw`\x3c3`, '<3'],
    [String.raw`été`, 'été'],
    [String.raw`\u{1F332}`, '🌲'],
  ])('decodes %s', (raw, text) => {
    expect(decodeJsStringLiteral(raw)).toBe(text);
  });

  it('decodes an emoji written as a surrogate pair', () => {
    expect(decodeJsStringLiteral(String.raw`🌲`)).toBe('🌲');
  });

  it('throws on an escape it does not know, rather than read it wrong', () => {
    expect(() => decodeJsStringLiteral(String.raw`odd \q`)).toThrow('unknown escape \\q');
  });
});
