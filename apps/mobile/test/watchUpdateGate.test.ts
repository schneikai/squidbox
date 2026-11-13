import { create, type AxiosAdapter } from 'axios';
import { describe, expect, it } from 'vitest';

import UpdateRequiredError from '../src/utils/cloud-api/UpdateRequiredError';
import { updateRequiredStore } from '../src/utils/cloud-api/updateRequiredStore';
import { UPDATE_REQUIRED_TEXT } from '../src/utils/cloud-api/updateRequiredText';
import watchUpdateGate from '../src/utils/cloud-api/watchUpdateGate';

// An API whose answers are `statuses`, one per request, rejected the way axios rejects a non-2xx.
function apiAnswering(...statuses: number[]) {
  const adapter: AxiosAdapter = async (config) => {
    const status = statuses.shift()!;
    const response = { status, statusText: '', headers: {}, config, data: { error: { message: 'from the server' } } };
    if (status >= 300) throw Object.assign(new Error(`Request failed with status code ${status}`), { response });
    return response;
  };
  const api = create({ adapter, baseURL: 'https://squidbox.test/api/v1' });
  watchUpdateGate(api);
  return api;
}

describe('the update gate in the API client', () => {
  it('turns a 426 into an UpdateRequiredError saying the app’s sentence, and a success clears it', async () => {
    const api = apiAnswering(426, 200);
    const refused = api.get('/sync/pull');
    await expect(refused).rejects.toBeInstanceOf(UpdateRequiredError);
    await expect(refused).rejects.toThrow(UPDATE_REQUIRED_TEXT);
    expect(updateRequiredStore.get()).toBe(true);
    await api.get('/sync/pull');
    expect(updateRequiredStore.get()).toBe(false);
  });

  it('a success from /up, which the gate never covers, leaves the store set', async () => {
    const api = apiAnswering(426, 200, 200);
    await expect(api.get('/sync/pull')).rejects.toBeInstanceOf(UpdateRequiredError);
    await api.get('https://squidbox.test/up');
    expect(updateRequiredStore.get()).toBe(true);
    await api.get('/sync/pull');
    expect(updateRequiredStore.get()).toBe(false);
  });

  it('leaves any other failure as it was', async () => {
    const api = apiAnswering(500);
    await expect(api.get('/sync/pull')).rejects.toThrow('Request failed with status code 500');
    expect(updateRequiredStore.get()).toBe(false);
  });
});
