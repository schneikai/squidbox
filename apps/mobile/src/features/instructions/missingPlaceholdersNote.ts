import { type InstructionKind, missingPlaceholders } from '@squidbox/shared';

import joinWords from '@/utils/joinWords';

/**
 * What the editor of `kind` notes while `text` lacks a placeholder the server fills ("This text has
 * no {caption} or {mentions}, so the assistant won't get them."), null while it has them all. Only
 * a note: leaving one out can be on purpose.
 */
export default function missingPlaceholdersNote(kind: InstructionKind, text: string): string | null {
  const names = missingPlaceholders(kind, text).map((name) => `{${name}}`);
  if (names.length === 0) return null;
  return `This text has no ${joinWords(names, 'or')}, so the assistant won't get ${names.length === 1 ? 'it' : 'them'}.`;
}
