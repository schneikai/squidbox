import isBlank from '@/utils/isBlank';

export default function presence(value) {
  return isBlank(value) ? null : value;
}
