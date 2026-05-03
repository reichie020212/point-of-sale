/**
 * Sentinel test for the API-side PIN hash. The same algorithm is
 * duplicated on the mobile client (`apps/mobile/src/state/pin-hash.ts`);
 * if the bytes drift between the two implementations, sign-in stops
 * working offline. This test pins one known input/output pair on the
 * server side; the mobile suite has the matching assertion.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { hashPin, isValidPin } from '../src/auth/pin-hash.js';

test('hashPin sentinel — must match the mobile impl byte-for-byte', () => {
  assert.equal(hashPin('00000000-0000-0000-0000-000000000000', '1234'), 'fc8fa131');
});

test('hashPin produces 8-char hex', () => {
  assert.match(hashPin('user-x', '5555'), /^[0-9a-f]{8}$/);
});

test('isValidPin', () => {
  assert.equal(isValidPin('1234'), true);
  assert.equal(isValidPin('12345'), false);
  assert.equal(isValidPin('abcd'), false);
});
