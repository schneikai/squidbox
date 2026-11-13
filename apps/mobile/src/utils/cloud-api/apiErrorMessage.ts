import envelopeMessage from './envelopeMessage';
import errorResponse from './errorResponse';
import isUpdateRequired from './isUpdateRequired';
import { UPDATE_REQUIRED_TEXT } from './updateRequiredText';

/**
 * What went wrong with a server call: the server's `{ error: { message } }` when it sent one; for a
 * build the server refuses as too old, the app's own sentence, which says what to do.
 */
export default function apiErrorMessage(error: unknown): string {
  if (isUpdateRequired(error)) return UPDATE_REQUIRED_TEXT;
  return (
    envelopeMessage(errorResponse(error)?.data) ??
    (error as { message?: string } | null | undefined)?.message ??
    'Something went wrong'
  );
}
