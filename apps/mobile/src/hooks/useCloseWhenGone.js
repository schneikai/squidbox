import useCloseWhen from '@/hooks/useCloseWhen';

/**
 * Closes the screen with an alert once its record is gone: `record` is `null` when it doesn't exist
 * (deleted, e.g. by a sync, while the screen was open), `undefined` while it loads. A screen that is
 * already leaving (its own delete went back) says nothing.
 */
export default function useCloseWhenGone(record, message) {
  useCloseWhen(record === null, message);
}
