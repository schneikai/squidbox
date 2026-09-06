import isPresent from '@/utils/isPresent';

export default function isBlank(value) {
  return !isPresent(value);
}
