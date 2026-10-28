import centsText from '@/utils/ai/centsText';

/** A model's cost line for its kind, in cents: "0.04¢ a reply", "2¢ per 100 photos". */
export default function formatCost(model, kind) {
  const isVision = kind === 'vision';
  const usd = isVision ? model.costPer100PhotosUsd : model.costPerReplyUsd;
  return `${centsText(usd)} ${isVision ? 'per 100 photos' : 'a reply'}`;
}
