/**
 * Memoizes a zero-arg async factory: a resolved attempt is cached forever, a
 * rejected attempt is NOT cached (the next call starts a fresh attempt), and
 * concurrent callers made while one attempt is in flight all share that same
 * attempt rather than starting their own.
 */
export function retryablePromise<T>(factory: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null;

  return function run(): Promise<T> {
    if (!cached) {
      cached = factory().catch((error: unknown) => {
        cached = null;
        throw error;
      });
    }
    return cached;
  };
}
