import { describe, it, expect } from 'vitest';

import apiErrorMessage from '../src/utils/cloud-api/apiErrorMessage';
import UploadFailedError from '../src/utils/cloud-api/assets/UploadFailedError';

describe('apiErrorMessage', () => {
  it('says the server’s message', () => {
    const error = { response: { status: 401, data: { error: { code: 'invalid_credentials', message: 'Wrong' } } } };
    expect(apiErrorMessage(error)).toBe('Wrong');
  });

  it('says to update, not the server’s message, when the server refuses this build as too old', () => {
    const request = { response: { status: 426, data: { error: { message: 'contract version 1; needs 2' } } } };
    expect(apiErrorMessage(request)).toBe('Update Squidbox to keep syncing');
    expect(apiErrorMessage(new UploadFailedError('contract version 1', { status: 426 }))).toBe(
      'Update Squidbox to keep syncing',
    );
  });
});
