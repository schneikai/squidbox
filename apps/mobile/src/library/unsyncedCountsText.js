import pluralizeText from '@/utils/pluralizeText';

// "3 changes and 12 photos" for what hasn't synced; null when everything has.
export default function unsyncedCountsText({ pendingCount, atRiskCount }) {
  const parts = [];
  if (pendingCount > 0) parts.push(pluralizeText('1 change', '%{count} changes', pendingCount));
  if (atRiskCount > 0) parts.push(pluralizeText('1 photo', '%{count} photos', atRiskCount));
  return parts.length > 0 ? parts.join(' and ') : null;
}
