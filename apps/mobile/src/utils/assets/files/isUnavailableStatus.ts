import type { UnavailableStatus } from './getAssetFileStatusAsync';

import isOneOf from '@/lib/isOneOf';

// Whether a file status says the file can't be had (assetFileUnavailableMessages has its message).
const isUnavailableStatus = isOneOf(['notUploaded', 'signedOut'] as const satisfies readonly UnavailableStatus[]);

export default isUnavailableStatus;
