// Auth wire contract — the request/response shapes shared by the app and the server (camelCase).
import { z } from 'zod';

export const apiUserSchema = z.object({
  id: z.string(), // uuid; the app treats it as opaque
  email: z.string(),
});
export type ApiUser = z.infer<typeof apiUserSchema>;

export const loginRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: apiUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

// Refresh returns tokens only, no user.
export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const userResponseSchema = z.object({
  user: apiUserSchema,
});
export type UserResponse = z.infer<typeof userResponseSchema>;
