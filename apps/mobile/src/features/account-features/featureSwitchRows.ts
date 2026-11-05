import { type UpdateFeaturesRequest, updateFeaturesRequestSchema } from '@squidbox/shared';

import featureText, { type FeatureText, type SwitchableFeature } from './featureText';

// In the contract's order: Assistant, then AI admin.
const SWITCHABLE_FEATURES = updateFeaturesRequestSchema.shape.feature.options;

type FeatureSwitchRow = Omit<FeatureText, 'requires'> & {
  feature: SwitchableFeature;
  isOn: boolean;
  isDisabled: boolean;
};

/**
 * Settings → Features' switches, one per feature the account can switch, given the account's
 * `features` and the change in flight (`pending`, the PATCH /me/features body on its way). The
 * pending change shows as it will be; while one is in flight every switch waits; a feature that
 * `requires` another is greyed out while that one is off.
 */
export default function featureSwitchRows(
  features: readonly string[],
  pending: UpdateFeaturesRequest | null,
): FeatureSwitchRow[] {
  function isOn(feature: SwitchableFeature): boolean {
    return pending?.feature === feature ? pending.isOn : features.includes(feature);
  }

  return SWITCHABLE_FEATURES.map((feature) => {
    const { title, description, requires } = featureText[feature];
    return {
      title,
      description,
      feature,
      isOn: isOn(feature),
      isDisabled: pending !== null || (requires !== undefined && !isOn(requires)),
    };
  });
}
