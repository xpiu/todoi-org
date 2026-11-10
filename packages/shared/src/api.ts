import { z } from 'zod';
import { Level } from './directory.ts';

/** One error shape for every non-2xx response. */
export const ApiError = z.object({
  error: z.object({
    code: z.enum([
      'bad_request',
      'unauthorized',
      'forbidden',
      'not_found',
      'conflict',
      'rate_limited',
      'internal',
    ]),
    message: z.string(),
    /** On a 409: the row as it stands now, so the editor can show the other value. */
    current: z.unknown().optional(),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

export const Slug = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case letters, digits and single hyphens');

export const LoginBody = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(200),
});
export type LoginBody = z.infer<typeof LoginBody>;

const text = (max: number) => z.string().trim().min(1).max(max);

/** Every editor write names the version it was based on; a stale one is a 409. */
export const RecordPatch = z
  .object({
    version: z.number().int().nonnegative(),
    name: text(120).optional(),
    url: z.url().max(500).optional(),
    blurb: text(400).optional(),
    year: z.number().int().min(1970).max(2100).optional(),
    band: z.number().int().min(1).max(5).optional(),
    integrationsLabel: text(40).optional(),
    integrations: z.number().int().min(0).max(100000).optional(),
    confidence: z.enum(['High', 'Medium-high', 'Medium']).optional(),
    caveat: text(2000).optional(),
    summary: z.array(text(4000)).min(1).max(8).optional(),
  })
  .strict();
export type RecordPatch = z.infer<typeof RecordPatch>;

export const ScorePut = z
  .object({
    version: z.number().int().nonnegative(),
    score: z
      .number()
      .min(1)
      .max(5)
      .refine((v) => Number.isInteger(Math.round(v * 10)) && Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, {
        message: 'one decimal at most',
      }),
    review: text(1000),
  })
  .strict();
export type ScorePut = z.infer<typeof ScorePut>;

export const CapabilityPut = z
  .object({
    version: z.number().int().nonnegative(),
    level: Level,
    note: z.string().trim().max(500).nullable(),
  })
  .strict();
export type CapabilityPut = z.infer<typeof CapabilityPut>;

export const FaqPut = z
  .object({
    version: z.number().int().nonnegative(),
    question: text(300),
    /** Inline HTML; the server sanitises it to <p>, <strong>, <em>, <a href>. */
    answer: text(4000),
  })
  .strict();
export type FaqPut = z.infer<typeof FaqPut>;

export const RecordCreate = z
  .object({
    slug: z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: text(120),
    url: z.url().max(500),
    blurb: text(400),
    model: z.string().min(1).max(40),
    year: z.number().int().min(1970).max(2100),
  })
  .strict();
export type RecordCreate = z.infer<typeof RecordCreate>;

export function isApiError(value: unknown): value is ApiError {
  return ApiError.safeParse(value).success;
}
