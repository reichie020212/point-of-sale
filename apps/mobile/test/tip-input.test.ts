/**
 * Unit test for the cart's tip-entry parser. Pure-string in, cents out.
 *
 * §9 closed: tipping is fixed-amount entry only. The mobile cart's
 * "Add tip" modal renders a numeric TextInput and runs the user's
 * draft through `parseTipInputCents` on every keystroke; this guards
 * the parser without booting RN.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTipInputCents } from '../src/state/tip-input';

test('parseTipInputCents — empty / whitespace input is null', () => {
  assert.equal(parseTipInputCents(''), null);
  assert.equal(parseTipInputCents('   '), null);
});

test('parseTipInputCents — whole pesos convert to cents', () => {
  assert.equal(parseTipInputCents('50'), 5000);
  assert.equal(parseTipInputCents('1'), 100);
  assert.equal(parseTipInputCents('0'), 0);
});

test('parseTipInputCents — one and two decimal places', () => {
  assert.equal(parseTipInputCents('50.5'), 5050);
  assert.equal(parseTipInputCents('12.50'), 1250);
  assert.equal(parseTipInputCents('0.99'), 99);
});

test('parseTipInputCents — strips a leading currency symbol', () => {
  assert.equal(parseTipInputCents('₱50'), 5000);
  assert.equal(parseTipInputCents('₱ 50.25'), 5025);
  assert.equal(parseTipInputCents('$10'), 1000);
});

test('parseTipInputCents — strips thousand separators', () => {
  assert.equal(parseTipInputCents('1,234'), 123400);
  assert.equal(parseTipInputCents('₱1,234.50'), 123450);
});

test('parseTipInputCents — rejects negative input', () => {
  assert.equal(parseTipInputCents('-1'), null);
  assert.equal(parseTipInputCents('-50.00'), null);
});

test('parseTipInputCents — rejects more than two decimal places', () => {
  assert.equal(parseTipInputCents('1.234'), null);
  assert.equal(parseTipInputCents('0.001'), null);
});

test('parseTipInputCents — rejects garbage input', () => {
  assert.equal(parseTipInputCents('abc'), null);
  assert.equal(parseTipInputCents('1.2.3'), null);
  assert.equal(parseTipInputCents('1px'), null);
});
