import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ApiError } from '@todoi/shared';

type Code = ApiError['error']['code'];

/** Thrown anywhere in a handler; app.onError turns it into the one error shape. */
export class HttpProblem extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: Code,
    message: string,
    readonly extra: Partial<Pick<ApiError['error'], 'current' | 'issues'>> = {},
  ) {
    super(message);
  }

  body(): ApiError {
    return { error: { code: this.code, message: this.message, ...this.extra } };
  }
}

export const notFound = (what: string) => new HttpProblem(404, 'not_found', `${what} not found`);
export const badRequest = (message: string, issues?: ApiError['error']['issues']) =>
  new HttpProblem(400, 'bad_request', message, issues ? { issues } : {});
export const conflict = (current: unknown) =>
  new HttpProblem(409, 'conflict', 'Someone else changed this since you loaded it.', { current });
export const unauthorized = () => new HttpProblem(401, 'unauthorized', 'Sign in to continue.');
export const forbidden = (message = 'Not allowed.') => new HttpProblem(403, 'forbidden', message);
