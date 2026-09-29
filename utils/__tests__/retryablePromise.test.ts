import { strict as assert } from 'node:assert';
import test from 'node:test';
import { retryablePromise } from '../retryablePromise';

test('resolves and caches: the factory runs once across repeated calls', async () => {
  let calls = 0;
  const run = retryablePromise(async () => {
    calls += 1;
    return 'ok';
  });

  assert.equal(await run(), 'ok');
  assert.equal(await run(), 'ok');
  assert.equal(calls, 1);
});

test('a rejection is not cached: the next call runs the factory again', async () => {
  let calls = 0;
  const run = retryablePromise(async () => {
    calls += 1;
    if (calls === 1) throw new Error('boom');
    return 'recovered';
  });

  await assert.rejects(run(), /boom/);
  assert.equal(calls, 1);

  assert.equal(await run(), 'recovered');
  assert.equal(calls, 2);
});

test('concurrent callers before the first attempt settles share one in-flight attempt', async () => {
  let calls = 0;
  // A holder object, not a plain `let`: a reassignment inside the executor
  // below loses its narrowed, non-null type across the `await` that follows
  // (a known TS CFA limit for closure-captured variables).
  const pending: { release: (() => void) | null } = { release: null };
  const run = retryablePromise(
    () =>
      new Promise<string>((resolve) => {
        calls += 1;
        pending.release = () => resolve('done');
      })
  );

  const first = run();
  const second = run();
  assert.equal(calls, 1, 'both callers should share the same in-flight attempt');

  assert.ok(pending.release, 'expected the factory to have started');
  pending.release();
  assert.equal(await first, 'done');
  assert.equal(await second, 'done');
});
