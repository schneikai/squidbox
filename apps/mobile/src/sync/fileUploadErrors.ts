// What a row's error says when its file was missing from the device (fileUploads): a merge that then
// delivers the file retries only such a row (retryMissingFiles), not one failed for another reason.
export const MISSING_ON_DEVICE = 'is missing on this device';

/**
 * A file upload that fails the same way when tried again (refused by the server, or the file missing
 * from the device): the sync flags the record's row with `message` and pushes the rest (sync-design
 * §6). `reason` is for the sync log.
 */
export class FileUploadRefusedError extends Error {
  readonly reason: string;
  constructor(message: string, reason: string) {
    super(message);
    this.name = 'FileUploadRefusedError';
    this.reason = reason;
  }
}
