/**
 * Pure unit tests for the timezone helpers. No DB; runs in every
 * environment.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays, isValidTimezone, startOfLocalDay } from '../src/util/timezone.js';

test('isValidTimezone accepts canonical IANA names', () => {
  assert.equal(isValidTimezone('UTC'), true);
  assert.equal(isValidTimezone('America/New_York'), true);
  assert.equal(isValidTimezone('Asia/Manila'), true);
  assert.equal(isValidTimezone('Europe/London'), true);
});

test('isValidTimezone rejects garbage', () => {
  assert.equal(isValidTimezone('Atlantis/Lost'), false);
  assert.equal(isValidTimezone(''), false);
  assert.equal(isValidTimezone('GMT+9'), false);
});

test('startOfLocalDay returns local midnight as UTC for America/New_York (EDT)', () => {
  // 2026-05-02 12:00 UTC = 08:00 EDT (UTC-4 in May).
  const now = new Date('2026-05-02T12:00:00Z');
  const start = startOfLocalDay(now, 'America/New_York');
  // Local NY midnight on 2026-05-02 = 04:00 UTC.
  assert.equal(start.toISOString(), '2026-05-02T04:00:00.000Z');
});

test('startOfLocalDay returns local midnight as UTC for Asia/Manila (UTC+8)', () => {
  // 2026-05-02 02:00 UTC = 10:00 Manila.
  const now = new Date('2026-05-02T02:00:00Z');
  const start = startOfLocalDay(now, 'Asia/Manila');
  // Local Manila midnight on 2026-05-02 = 16:00 UTC on 2026-05-01.
  assert.equal(start.toISOString(), '2026-05-01T16:00:00.000Z');
});

test('startOfLocalDay returns the start of the same UTC day for UTC', () => {
  const now = new Date('2026-05-02T18:30:00Z');
  const start = startOfLocalDay(now, 'UTC');
  assert.equal(start.toISOString(), '2026-05-02T00:00:00.000Z');
});

test('startOfLocalDay handles a moment that is "tomorrow" in local but "today" in UTC', () => {
  // 2026-05-02 16:00 UTC = 2026-05-03 00:00 Manila (just past local midnight).
  const now = new Date('2026-05-02T16:30:00Z');
  const start = startOfLocalDay(now, 'Asia/Manila');
  // Local Manila day for that moment is 2026-05-03; midnight = 16:00 UTC.
  assert.equal(start.toISOString(), '2026-05-02T16:00:00.000Z');
});

test('addDays adds whole UTC days', () => {
  const a = new Date('2026-05-02T12:00:00Z');
  assert.equal(addDays(a, 1).toISOString(), '2026-05-03T12:00:00.000Z');
  assert.equal(addDays(a, -2).toISOString(), '2026-04-30T12:00:00.000Z');
});
