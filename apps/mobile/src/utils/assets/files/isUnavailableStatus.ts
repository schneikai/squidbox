import assetFileUnavailableMessages from './assetFileUnavailableMessages';
import type { UnavailableStatus } from './getAssetFileStatusAsync';

// Whether a file status says the file can't be had: every status assetFileUnavailableMessages has a
// message for (its keys are exactly UnavailableStatus, by its `satisfies`).
export default function isUnavailableStatus(status: string | undefined): status is UnavailableStatus {
  return status !== undefined && Object.hasOwn(assetFileUnavailableMessages, status);
}
