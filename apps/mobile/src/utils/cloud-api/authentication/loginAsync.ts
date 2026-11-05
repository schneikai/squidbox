import type { LoginRequest, LoginResponse } from '@squidbox/shared';

import api from '../api';
import { API_BASE_URL } from '../apiBaseUrl';

import type { Session } from '@/library/session';

// Signs in and resolves the session the server answered with; the caller stores it once its
// library is open.
export default async function loginAsync(email: string, password: string): Promise<Session> {
  if (!API_BASE_URL) throw new Error('This build has no API URL (EXPO_PUBLIC_API_URL)');
  const {
    data: { accessToken, refreshToken, user, serverId },
  } = await api.post<LoginResponse>('auth/login', { email, password } satisfies LoginRequest);
  return {
    serverId,
    userId: user.id,
    email: user.email,
    features: user.features ?? [],
    apiBaseUrl: API_BASE_URL,
    tokens: { accessToken, refreshToken },
  };
}
