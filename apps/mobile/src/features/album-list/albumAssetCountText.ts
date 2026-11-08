import pluralizeText from '@/utils/pluralizeText';

// How many assets an album holds, e.g. "12 Assets".
export default function albumAssetCountText(count: number): string {
  return pluralizeText('1 Asset', '%{count} Assets', count);
}
