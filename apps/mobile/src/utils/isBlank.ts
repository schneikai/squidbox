import isPresent from '@/utils/isPresent';

export default function isBlank(value: unknown): boolean {
  return !isPresent(value);
}
