// Whether two owners name the same account: the same user on the same server.
export function sameAccount(a: { serverId: string; userId: string }, b: { serverId: string; userId: string }): boolean {
  return a.userId === b.userId && a.serverId === b.serverId;
}
