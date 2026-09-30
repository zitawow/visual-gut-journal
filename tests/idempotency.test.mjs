import assert from 'node:assert/strict';
import test from 'node:test';
import { createCaptureOperationKey } from '../src/services/idempotency.ts';

test('capture operation keys satisfy the backend contract', () => {
  const keys = Array.from({ length: 100 }, () => createCaptureOperationKey());
  assert.equal(new Set(keys).size, keys.length);
  for (const key of keys) {
    assert.match(key, /^[a-zA-Z0-9_-]{20,100}$/);
  }
});
