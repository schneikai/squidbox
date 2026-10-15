// Who a library belongs to: this device alone, or an account on a server. serverId is null until
// the server has reported its identity (a converted install before its first /me).
export type AccountOwner = { kind: 'account'; serverId: string | null; userId: string; email: string };
export type Owner = { kind: 'device' } | AccountOwner;
