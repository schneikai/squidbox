import confirmAsync from '@/utils/confirmAsync';

/** Asks before contacts (`names`) come off every photo of an album they are on: true once confirmed. */
export default function confirmRemoveFromAlbumPhotos(names: string[]): Promise<boolean> {
  const isOne = names.length === 1;
  return confirmAsync({
    title: isOne ? `Remove ${names[0]}?` : `Remove ${names.length} contacts?`,
    message: `${names.join(', ')} ${isOne ? 'comes' : 'come'} off every photo of this album they are on.`,
    action: 'Remove',
    destructive: true,
  });
}
