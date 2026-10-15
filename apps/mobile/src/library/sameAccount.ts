// Whether two owners name the same account: the same user on the same server. A null serverId is
// one not resolved yet (a converted install before its first /me), never a different server.
export function sameAccount(
  a: { serverId: string | null; userId: string | null },
  b: { serverId: string | null; userId: string | null },
): boolean {
  if (a.userId === null || a.userId !== b.userId) return false;
  return a.serverId === b.serverId || a.serverId === null || b.serverId === null;
}
