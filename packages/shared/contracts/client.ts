// What a build says about itself on every request (docs/sync-design.md §15): the commit it was built
// from and the install it runs on. The server ignores it until it records which builds are installed
// (todo.md).
export const CLIENT_HEADER = 'x-squidbox-client';

export type ClientInfo = { build: string; device: string };

/** The header's value: `<commit> <device>`. */
export function formatClientInfo({ build, device }: ClientInfo): string {
  return `${build} ${device}`;
}
