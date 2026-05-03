/**
 * Unit tests for the mobile PIN hash + validation helpers.
 *
 * The hash function MUST be byte-identical with the API server's
 * implementation (`apps/api/src/auth/pin-hash.ts`). The first test
 * pins one known input/output pair; if anyone changes the algorithm
 * on either side without updating both, this test catches it.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { hashPin, isValidPin, verifyPin } from '../src/state/pin-hash';

test('hashPin', async (t) => {
  await t.test('produces an 8-char zero-padded hex string', () => {
    const hash = hashPin('user-1', '1234');
    assert.match(hash, /^[0-9a-f]{8}$/);
  });
  await t.test('different users with the same PIN hash differently', () => {
    const a = hashPin('user-A', '1234');
    const b = hashPin('user-B', '1234');
    assert.notEqual(a, b);
  });
  await t.test('same user + same PIN is deterministic', () => {
    assert.equal(hashPin('user-1', '4321'), hashPin('user-1', '4321'));
  });
  await t.test(
    'algorithm matches the byte-identical server impl (regression sentinel)',
    () => {
      // Computed with the same FNV-1a routine; if either implementation
      // drifts this assertion will fail and force the team to re-verify
      // both files together. Recompute by running:
      //   node -e "const {hashPin}=require('./src/state/pin-hash'); console.log(hashPin('00000000-0000-0000-0000-000000000000','1234'))"
      assert.equal(
        hashPin('00000000-0000-0000-0000-000000000000', '1234'),
        'fc8fa131',
      );
    },
  );
});

test('isValidPin', async (t) => {
  await t.test('accepts exactly 4 digits', () => {
    assert.equal(isValidPin('0000'), true);
    assert.equal(isValidPin('1234'), true);
    assert.equal(isValidPin('9999'), true);
  });
  await t.test('rejects wrong length', () => {
    assert.equal(isValidPin(''), false);
    assert.equal(isValidPin('123'), false);
    assert.equal(isValidPin('12345'), false);
  });
  await t.test('rejects non-digits', () => {
    assert.equal(isValidPin('12a4'), false);
    assert.equal(isValidPin('12 4'), false);
    assert.equal(isValidPin('-123'), false);
  });
});

test('verifyPin', async (t) => {
  const userId = 'user-verify';
  const goodHash = hashPin(userId, '1234');

  await t.test('accepts the right PIN', () => {
    assert.equal(verifyPin(userId, '1234', goodHash), true);
  });
  await t.test('rejects the wrong PIN', () => {
    assert.equal(verifyPin(userId, '4321', goodHash), false);
  });
  await t.test('rejects when stored hash is null', () => {
    assert.equal(verifyPin(userId, '1234', null), false);
  });
  await t.test('rejects when hash is computed for a different user', () => {
    const otherHash = hashPin('someone-else', '1234');
    assert.equal(verifyPin(userId, '1234', otherHash), false);
  });
});
