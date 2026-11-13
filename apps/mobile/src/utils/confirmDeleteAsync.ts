import confirmAsync from '@/utils/confirmAsync';

type ConfirmDeleteOptions = { name: string; also?: string };

// The one delete confirm: "Delete <name>?" (a name, "this rule", "3 items"), Cancel · Delete in red,
// and a message only when `also` says what else happens (it goes from every device, its contacts
// stay). Whether the user confirmed.
export default function confirmDeleteAsync({ name, also }: ConfirmDeleteOptions): Promise<boolean> {
  return confirmAsync({ title: `Delete ${name}?`, message: also, action: 'Delete', destructive: true });
}
