// Who a session belongs to. Work that outlives a request (a sync run, a backup run) captures the
// identity at its start and every token read checks the stored session still has it.
export default function sessionIdentity(session) {
  return { serverId: session.serverId, userId: session.userId };
}
