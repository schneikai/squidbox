import { UPDATE_REQUIRED_TEXT } from './updateRequiredText';

/**
 * The server refused this build as too old (its update gate, docs/sync-design.md §15): what every
 * request and upload that got UPDATE_REQUIRED_STATUS rejects with. A sync or backup run ends on it
 * like on a session change (sync/runGate.ts); its message is the app's own sentence.
 */
export default class UpdateRequiredError extends Error {
  constructor() {
    super(UPDATE_REQUIRED_TEXT);
    this.name = 'UpdateRequiredError';
  }
}
