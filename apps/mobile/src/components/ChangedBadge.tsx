import Badge from '@/components/Badge';

// "Changed" on an entry whose setting differs from the app's default (an instruction, a kind's model
// picks, a model you picked as a default).
export default function ChangedBadge() {
  return <Badge label="Changed" tone="accent" />;
}
