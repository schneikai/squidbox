import confirmAsync from '@/utils/confirmAsync';

// The confirm for taking a post's part out of it: "Remove <name>?" (this post, a channel from this
// post), Cancel · Remove in red. Whether the user confirmed.
export default function confirmRemoveAsync(name: string): Promise<boolean> {
  return confirmAsync({
    title: `Remove ${name}?`,
    message: 'Its text and photos go with it.',
    action: 'Remove',
    destructive: true,
  });
}
