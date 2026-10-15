// Who a session belongs to. Work that outlives a request (a sync run, a backup run) captures the
// identity at its start and every token read checks the stored session still has it.
export function sessionIdentity(session) {
  return { serverId: session.serverId, userId: session.userId };
}

// A null serverId is an unresolved one (a converted install before its first /me), never a
// different server.
export function isSameIdentity(a, b) {
  if (a.userId !== b.userId) return false;
  return a.serverId === b.serverId || a.serverId === null || b.serverId === null;
}
