import Badge from '@/components/Badge';

// "Changed" on an entry whose setting differs from the app's default (an instruction, a kind's model
// picks, a model you picked as a default). The parent positions it through `style`.
export default function ChangedBadge({ style }) {
  return <Badge label="Changed" tone="accent" style={style} />;
}
