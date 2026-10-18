// Who a library belongs to: this device alone, or an account on a server.
export type Owner = { kind: 'device' } | { kind: 'account'; serverId: string; userId: string; email: string };
