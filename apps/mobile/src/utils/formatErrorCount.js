import pluralizeText from './pluralizeText';

// "1 error", "3 errors": a status row's count of failures.
export default function formatErrorCount(count) {
  return pluralizeText('1 error', '%{count} errors', count);
}
