// Single, consistent error envelope for the whole API: { error: { code, message } }.
// Throw AppError anywhere; the Fastify error handler (plugins/errorHandler) renders it. The codes and
// the envelope are the shared contract (packages/shared/contracts/server.ts), which the app reads.
import type { ApiError, ApiErrorCode } from '@squidbox/shared';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;

  constructor(statusCode: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(401, 'unauthorized', message);
  }
  static invalidCredentials(message = 'Invalid email or password') {
    return new AppError(401, 'invalid_credentials', message);
  }
  static invalidToken(message = 'Invalid or expired token') {
    return new AppError(401, 'invalid_token', message);
  }
  static validation(message: string) {
    return new AppError(400, 'validation_error', message);
  }
  static notFound(message = 'Not found') {
    return new AppError(404, 'not_found', message);
  }
  static s3(message: string) {
    return new AppError(502, 's3_error', message);
  }
  static aiNotConfigured() {
    return new AppError(503, 'ai_not_configured', 'AI is not configured on the server');
  }
  static aiNotAllowed() {
    return new AppError(403, 'ai_not_allowed', 'AI is not enabled for this account');
  }
  static aiAdminNotAllowed() {
    return new AppError(403, 'ai_admin_not_allowed', 'AI admin tools are not enabled for this account');
  }
  static developerOnly() {
    return new AppError(403, 'developer_only', 'Changing features is not enabled for this account');
  }
  static aiUnavailable(message: string) {
    return new AppError(502, 'ai_unavailable', message);
  }
}

export function errorBody(code: ApiErrorCode, message: string): ApiError {
  return { error: { code, message } };
}

/** What went wrong, as one line: an Error's message, else the thrown value as text. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
