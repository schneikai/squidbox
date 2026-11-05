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
