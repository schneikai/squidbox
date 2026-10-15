import deviceLabel from './deviceLabel';

// How a library is named to the user: the account's email, or this device.
export default function libraryLabel(library) {
  if (library.owner.kind === 'account') return library.owner.email || 'Your account';
  return deviceLabel();
}
