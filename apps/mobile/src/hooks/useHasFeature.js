import useCloud from '@/features/cloud/useCloud';

/**
 * Whether the signed-in account has this feature (ACCOUNT_FEATURES in @squidbox/shared), an extra on
 * top of the defaults that the server grants per account. False while signed out.
 */
export default function useHasFeature(feature) {
  const { isAuthenticated, user } = useCloud();
  return isAuthenticated && user.features.includes(feature);
}
