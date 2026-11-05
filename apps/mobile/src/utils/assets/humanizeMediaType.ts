import { MEDIA_TYPES } from './constants';

// Create a reverse mapping
const REVERSE_MEDIA_TYPES: Partial<Record<string, string>> = Object.fromEntries(
  Object.entries(MEDIA_TYPES).map(([key, value]) => [value, key]),
);

const MEDIA_TYPES_HUMANIZED: Partial<Record<string, { singular: string; plural: string }>> = {
  IMAGE: {
    singular: 'Photo',
    plural: 'Photos',
  },
  VIDEO: {
    singular: 'Video',
    plural: 'Videos',
  },
};

export default function humanizeMediaType(mediaTypeValue: string, count = 1): string {
  const mediaType = REVERSE_MEDIA_TYPES[mediaTypeValue] || mediaTypeValue;
  const singularOrPlural = count === 1 ? 'singular' : 'plural';
  return MEDIA_TYPES_HUMANIZED[mediaType]?.[singularOrPlural] || mediaType;
}
