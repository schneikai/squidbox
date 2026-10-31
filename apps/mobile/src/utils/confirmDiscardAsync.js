import confirmAsync from '@/utils/confirmAsync';

// Whether the user chose to discard the changes in a sheet's draft (Keep editing · Discard).
export default function confirmDiscardAsync() {
  return confirmAsync({
    title: 'Discard changes?',
    message: 'Your changes are not saved.',
    cancel: 'Keep editing',
    action: 'Discard',
    destructive: true,
  });
}
