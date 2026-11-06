// The X profile page holds its data as JavaScript (seroval, TanStack's stream), not JSON: besides
// `\"` it escapes `<` as `\x3c` and quotes as `\'`, which JSON.parse refuses.

const SIMPLE_ESCAPES: Record<string, string> = {
  '"': '"',
  "'": "'",
  '\\': '\\',
  '/': '/',
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
};

/**
 * The text of a JS string literal's body (what lies between its quotes): `\"`, `\'`, `\\`, `\/`,
 * `\n`, `\r`, `\t`, `\b`, `\f`, `\xHH`, `\uHHHH` and `\u{H…}` decoded. Any other escape throws
 * (`unknown escape \q`), so a page X changed fails loudly rather than reads wrong. Never eval.
 */
export function decodeJsStringLiteral(raw: string): string {
  return raw.replace(
    /\\(u\{([0-9A-Fa-f]{1,6})\}|u([0-9A-Fa-f]{4})|x([0-9A-Fa-f]{2})|[\s\S])/g,
    (match, escape: string, codePoint?: string, unit?: string, byte?: string) => {
      if (codePoint !== undefined) return String.fromCodePoint(parseInt(codePoint, 16));
      if (unit !== undefined) return String.fromCharCode(parseInt(unit, 16));
      if (byte !== undefined) return String.fromCharCode(parseInt(byte, 16));
      const simple = SIMPLE_ESCAPES[escape];
      if (simple === undefined) throw new Error(`unknown escape ${match}`);
      return simple;
    },
  );
}
