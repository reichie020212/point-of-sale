/**
 * Unit test for the Sentry PII scrubber. Pure function, no SDK boot.
 *
 * The scrubber gates HANDOFF non-negotiable #6 ("your data is yours")
 * at the observability boundary: a stray `customer.email = 'x@y'` in
 * an error context must not leave the process.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { scrubObject } from '../src/observability/scrub.js';

test('scrubObject — leaves non-sensitive keys untouched', () => {
  const input = { id: 'org_1', name: 'Cafe Manila', tier: 'pro' };
  const out = scrubObject(input);
  assert.deepEqual(out, input);
  assert.notEqual(out, input); // returns a fresh object
});

test('scrubObject — redacts pin_hash + bare pin', () => {
  const out = scrubObject({ pin_hash: 'fnv-deadbeef', pin: '1234', other: 'fine' });
  assert.equal(out.pin_hash, '[REDACTED]');
  assert.equal(out.pin, '[REDACTED]');
  assert.equal(out.other, 'fine');
});

test('scrubObject — redacts device_token / device_secret', () => {
  const out = scrubObject({ device_token: 'dvc_xxx', device_secret: 'shh' });
  assert.equal(out.device_token, '[REDACTED]');
  assert.equal(out.device_secret, '[REDACTED]');
});

test('scrubObject — redacts stripe customer/subscription ids', () => {
  const out = scrubObject({
    stripe_customer_id: 'cus_xxx',
    stripe_subscription_id: 'sub_xxx',
    stripe_price_id: 'price_xxx', // not in the redact list
  });
  assert.equal(out.stripe_customer_id, '[REDACTED]');
  assert.equal(out.stripe_subscription_id, '[REDACTED]');
  assert.equal(out.stripe_price_id, 'price_xxx');
});

test('scrubObject — redacts authorization + cookie headers', () => {
  const out = scrubObject({
    request: {
      headers: {
        authorization: 'Bearer xxx',
        cookie: 'session=xxx',
        'user-agent': 'curl/8',
      },
    },
  });
  const headers = (out.request as { headers: Record<string, string> }).headers;
  assert.equal(headers.authorization, '[REDACTED]');
  assert.equal(headers.cookie, '[REDACTED]');
  assert.equal(headers['user-agent'], 'curl/8');
});

test('scrubObject — redacts customer pii', () => {
  const out = scrubObject({
    customer: { name: 'Maria', email: 'maria@example.com', phone: '+639171234567' },
  });
  const c = out.customer as Record<string, string>;
  assert.equal(c.name, 'Maria');
  assert.equal(c.email, '[REDACTED]');
  assert.equal(c.phone, '[REDACTED]');
});

test('scrubObject — redacts cardholder data even in nested objects', () => {
  const out = scrubObject({
    payment: { pan: '4242', cvv: '123', card: { last4: '4242' } },
  });
  const p = out.payment as Record<string, unknown>;
  assert.equal(p.pan, '[REDACTED]');
  assert.equal(p.cvv, '[REDACTED]');
  assert.equal(p.card, '[REDACTED]');
});

test('scrubObject — walks arrays', () => {
  const out = scrubObject({
    users: [
      { id: 'u_1', email: 'a@b' },
      { id: 'u_2', email: 'c@d' },
    ],
  });
  const u = out.users as Array<Record<string, string>>;
  assert.equal(u[0]?.id, 'u_1');
  assert.equal(u[0]?.email, '[REDACTED]');
  assert.equal(u[1]?.email, '[REDACTED]');
});

test('scrubObject — handles null and primitives', () => {
  assert.equal(scrubObject(null), null);
  assert.equal(scrubObject(undefined), undefined);
  assert.equal(scrubObject('hello'), 'hello');
  assert.equal(scrubObject(42), 42);
});

test('scrubObject — does not infinite-loop on cycles (depth-bounded)', () => {
  const cyclic: Record<string, unknown> = { name: 'x' };
  cyclic.self = cyclic;
  // Just assert it returns without throwing.
  const out = scrubObject(cyclic) as Record<string, unknown>;
  assert.equal(out.name, 'x');
});

test('scrubObject — case-insensitive on keys', () => {
  const out = scrubObject({ Email: 'x@y', AUTHORIZATION: 'Bearer x', PIN: '1234' });
  assert.equal((out as Record<string, string>).Email, '[REDACTED]');
  assert.equal((out as Record<string, string>).AUTHORIZATION, '[REDACTED]');
  assert.equal((out as Record<string, string>).PIN, '[REDACTED]');
});
