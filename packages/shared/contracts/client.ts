// What a build says about itself on every request (docs/sync-design.md §15): the contract it speaks,
// the commit it was built from and the install it runs on. The server records it per device.
export const CLIENT_HEADER = 'x-squidbox-client';

export type ClientInfo = { contract: number; build: string; device: string };

const CLIENT_INFO = /^(\d+) ([0-9a-f]{40}) ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** The header's value: `<contract> <commit> <device>`. */
export function formatClientInfo({ contract, build, device }: ClientInfo): string {
  return `${contract} ${build} ${device}`;
}

/** The header's value read back, or null for anything that isn't a contract, a full commit sha and a uuid. */
export function parseClientInfo(value: string): ClientInfo | null {
  const match = CLIENT_INFO.exec(value);
  if (!match) return null;
  return { contract: Number(match[1]), build: match[2]!, device: match[3]! };
}
