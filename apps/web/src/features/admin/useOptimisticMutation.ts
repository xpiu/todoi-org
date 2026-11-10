import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { HttpError } from '../../lib/api.ts';
import { conflictCurrent } from './api.ts';
import { useToasts } from './toasts.tsx';
import { directoryKeys } from '../directory/queries.ts';

interface Options<TCache, TVars, TResult> {
  /** The cache entry the editor renders from. */
  queryKey: QueryKey;
  /** The directory whose public pages this write changes. */
  directory: string;
  /** Send the change, with the version it was based on. */
  mutationFn: (vars: TVars) => Promise<TResult>;
  /** The new value, written into the cache before the server answers. */
  apply: (cache: TCache, vars: TVars) => TCache;
  /** The server's answer (a new version), written into the cache when it arrives. */
  reconcile?: (cache: TCache, result: TResult, vars: TVars) => TCache;
  /** Human words for the toast: "Huly: Ease of deployment". */
  describe: (vars: TVars) => string;
  /** How to show the value another editor saved, on a 409. */
  describeConflict?: (current: unknown, vars: TVars) => string;
}

/**
 * Every editor write goes through here.
 *  1. onMutate: cancel in-flight queries, snapshot the cache, write the new
 *     value. The row, its Score and its sort position update at once.
 *  2. The change goes to the server with the row's version.
 *  3. onError: restore the snapshot and say why. On a 409, show the other
 *     editor's value.
 *  4. onSettled: invalidate, so the server has the last word.
 */
export function useOptimisticMutation<TCache, TVars, TResult>(opts: Options<TCache, TVars, TResult>) {
  const queryClient = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: opts.mutationFn,
    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey: opts.queryKey });
      const snapshot = queryClient.getQueryData<TCache>(opts.queryKey);
      if (snapshot !== undefined) queryClient.setQueryData<TCache>(opts.queryKey, opts.apply(snapshot, vars));
      return { snapshot };
    },
    onSuccess: (result, vars) => {
      if (opts.reconcile) {
        queryClient.setQueryData<TCache>(opts.queryKey, (cache) => (cache === undefined ? cache : opts.reconcile!(cache, result, vars)));
      }
      toast.add({ title: 'Saved', description: opts.describe(vars), type: 'success' });
    },
    onError: (err, vars, ctx) => {
      if (ctx?.snapshot !== undefined) queryClient.setQueryData(opts.queryKey, ctx.snapshot);
      const current = conflictCurrent(err);
      if (current !== undefined) {
        toast.add({
          title: 'Someone else changed this first',
          description: `${opts.describe(vars)}. ${opts.describeConflict ? opts.describeConflict(current, vars) : 'Their version is now on screen.'} Your change was not saved.`,
          type: 'error',
        });
      } else {
        const why = err instanceof HttpError ? err.message : 'The server could not be reached.';
        toast.add({ title: 'Not saved', description: `${opts.describe(vars)}: ${why}`, type: 'error' });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opts.queryKey });
      void queryClient.invalidateQueries({ queryKey: directoryKeys.directory(opts.directory) });
    },
  });
}
