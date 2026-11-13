import type { LoginRequest, LoginResponse } from '@squidbox/shared';

import type { Session } from '@/library/session';
import api from '@/utils/cloud-api/api';
import requireApiBaseUrl from '@/utils/cloud-api/requireApiBaseUrl';

// Signs in and resolves the session the server answered with; the caller stores it once its
// library is open.
export default async function loginAsync(email: string, password: string): Promise<Session> {
  const apiBaseUrl = requireApiBaseUrl();
  const {
    data: { accessToken, refreshToken, user, serverId },
  } = await api.post<LoginResponse>('auth/login', { email, password } satisfies LoginRequest);
  return {
    serverId,
    userId: user.id,
    email: user.email,
    features: user.features ?? [],
    apiBaseUrl,
    tokens: { accessToken, refreshToken },
  };
}
