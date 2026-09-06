import { MEDIA_TYPES } from './constants';

// Create a reverse mapping
const REVERSE_MEDIA_TYPES = Object.fromEntries(Object.entries(MEDIA_TYPES).map(([key, value]) => [value, key]));

const MEDIA_TYPES_HUMANIZED = {
  IMAGE: {
    singular: 'Image',
    plural: 'Images',
  },
  VIDEO: {
    singular: 'Video',
    plural: 'Videos',
  },
};

export default function humanizeMediaType(mediaTypeValue, count = 1) {
  const mediaType = REVERSE_MEDIA_TYPES[mediaTypeValue] || mediaTypeValue;
  const singularOrPlural = count === 1 ? 'singular' : 'plural';
  return (MEDIA_TYPES_HUMANIZED[mediaType] || {})[singularOrPlural] || mediaType;
}
