import type { LoginRequest, LoginResponse } from '@squidbox/shared';

import api from '../api';
import { API_BASE_URL } from '../apiBaseUrl';

import type { Session } from '@/library/session';

// Signs in and resolves the session the server answered with; the caller stores it once its
// library is open.
export default async function loginAsync(email: string, password: string): Promise<Session> {
  const body: LoginRequest = { email, password };
  const {
    data: { accessToken, refreshToken, user, serverId },
  } = await api.post<LoginResponse>('auth/login', body);
  return {
    serverId,
    userId: user.id,
    email: user.email,
    features: user.features ?? [],
    apiBaseUrl: API_BASE_URL,
    tokens: { accessToken, refreshToken },
  };
}
