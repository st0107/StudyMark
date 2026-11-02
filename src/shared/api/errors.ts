export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code = 'UNKNOWN_ERROR', status = 500) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
