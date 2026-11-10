import { validator } from 'hono/validator';
import type { ValidationTargets } from 'hono';
import type { z } from 'zod';
import { badRequest } from '../errors.ts';

/**
 * Parse a request part with a Zod schema at the boundary. The handler sees
 * the parsed value, the RPC client sees the schema's input type, and a bad
 * value is a 400 in the one error shape, naming each field.
 */
export function zv<T extends keyof ValidationTargets, S extends z.ZodType>(target: T, schema: S) {
  return validator(target, (value): z.infer<S> => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw badRequest(
        'The request did not validate.',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
    return parsed.data;
  });
}
