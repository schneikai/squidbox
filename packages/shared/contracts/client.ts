// The header every request names its build with (docs/sync-design.md §15): `<commit> <device>`, the
// git sha the build was made from and the install's id (apps/mobile/src/utils/cloud-api/clientHeader.ts).
// The server ignores it until it records which builds are installed (todo.md).
export const CLIENT_HEADER = 'x-squidbox-client';
