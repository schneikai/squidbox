// Single, consistent error envelope for the whole API: { error: { code, message } }.
// Throw AppError anywhere; the Fastify error handler (plugins/errorHandler) renders it.

export type ErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'invalid_credentials'
  | 'invalid_token'
  | 'not_found'
  | 'rate_limited'
  | 's3_error'
  | 'internal';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
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
  static notFound(message = 'Not found') {
    return new AppError(404, 'not_found', message);
  }
  static s3(message: string) {
    return new AppError(502, 's3_error', message);
  }
}

export function errorBody(code: ErrorCode, message: string) {
  return { error: { code, message } };
}
