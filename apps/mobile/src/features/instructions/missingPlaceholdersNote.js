import { missingPlaceholders } from '@squidbox/shared';

/**
 * What the editor of `kind` notes while `text` lacks a placeholder the server fills ("This text has
 * no {caption} or {mentions}, so the assistant won't get them."), null while it has them all. Only
 * a note: leaving one out can be on purpose.
 */
export default function missingPlaceholdersNote(kind, text) {
  const names = missingPlaceholders(kind, text).map((name) => `{${name}}`);
  if (names.length === 0) return null;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
  return `This text has no ${list}, so the assistant won't get ${names.length === 1 ? 'it' : 'them'}.`;
}
