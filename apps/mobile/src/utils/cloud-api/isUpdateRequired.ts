import { UPDATE_REQUIRED_STATUS } from '@squidbox/shared';

import UploadFailedError from './assets/UploadFailedError';
import errorResponse from './errorResponse';

/**
 * Whether the server refused this build as too old (its update gate, docs/sync-design.md §15): a
 * request's or an upload's answer with UPDATE_REQUIRED_STATUS. Decided on the status, never the text.
 */
export default function isUpdateRequired(error: unknown): boolean {
  const status = error instanceof UploadFailedError ? error.status : errorResponse(error)?.status;
  return status === UPDATE_REQUIRED_STATUS;
}
