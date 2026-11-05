const HANDLE_REASONS = [
  ['xHandle', 'Same X handle'],
  ['blueskyHandle', 'Same Bluesky handle'],
  ['onlyFansHandle', 'Same OnlyFans handle'],
  ['jffHandle', 'Same JFF handle'],
];

/**
 * The contacts a new one may duplicate: those with one of its handles (stored fields, normalized),
 * each with why ("Same name and X handle" when the name matches too, ignoring case), and the fields
 * they share. `contacts` are the live contacts' names and handles.
 */
export default function findDuplicates(fields, contacts) {
  const name = fields.name.trim().toLowerCase();
  const matches = [];
  const sharedFields = new Set();
  for (const contact of contacts) {
    const shared = HANDLE_REASONS.filter(([field]) => fields[field] && fields[field] === contact[field]);
    if (shared.length === 0) continue;
    for (const [field] of shared) sharedFields.add(field);
    const [firstField, firstReason] = shared[0];
    const isSameName = !!name && contact.name.trim().toLowerCase() === name;
    if (isSameName) sharedFields.add('name');
    const reason = isSameName && firstField === 'xHandle' ? 'Same name and X handle' : firstReason;
    matches.push({ contact, reason });
  }
  return { matches, sharedFields };
}
