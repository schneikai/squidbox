import pluralizeText from './pluralizeText';

// "1 error", "3 errors": a status row's count of failures.
export default function formatErrorCount(count: number): string {
  return pluralizeText('1 error', '%{count} errors', count);
}
