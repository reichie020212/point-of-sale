/**
 * Unit test for the pure helpers behind `useOrgSettings`.
 *
 * The Zustand action `applyFromRecord` is a thin wrapper around
 * `recordToSettings(record, current)` plus a SecureStore write —
 * the parsing logic lives in the helper so we can pin its contract
 * without booting RN's expo-secure-store / Zustand stack.
 *
 * Blueprint #19 makes the `organizations` row sync-replicated; this
 * test guards the snake_case → cart-math conversion at the EVENT
 * boundary.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_ORG_SETTINGS,
  parseTaxRate,
  recordToSettings,
} from '../src/state/org-settings-helpers';

test('parseTaxRate', async (t) => {
  await t.test('percent string → fraction', () => {
    assert.equal(parseTaxRate('12.000'), 0.12);
    assert.equal(parseTaxRate('0.000'), 0);
    assert.equal(parseTaxRate('5.5'), 0.055);
  });
  await t.test('garbage / negative → 0 (no tax, never NaN)', () => {
    assert.equal(parseTaxRate('not-a-number'), 0);
    assert.equal(parseTaxRate('-1'), 0);
    assert.equal(parseTaxRate(''), 0);
  });
});

test('recordToSettings', async (t) => {
  await t.test('full snake_case record → updated settings', () => {
    const next = recordToSettings(
      {
        id: 'org-1',
        org_id: 'org-1',
        tax_rate: '15.000',
        currency: 'USD',
        timezone: 'America/New_York',
        telemetry_enabled: false,
      },
      DEFAULT_ORG_SETTINGS,
    );
    assert.equal(next.taxRate, 0.15);
    assert.equal(next.currency, 'USD');
    assert.equal(next.timezone, 'America/New_York');
    assert.equal(next.telemetryEnabled, false);
  });

  await t.test('partial record falls back to current for missing fields', () => {
    const current = {
      taxRate: 0.12,
      currency: 'PHP',
      timezone: 'Asia/Manila',
      telemetryEnabled: true,
    };
    const next = recordToSettings({ id: 'org-1', tax_rate: '0.000' }, current);
    assert.equal(next.taxRate, 0);
    assert.equal(next.currency, 'PHP'); // unchanged
    assert.equal(next.timezone, 'Asia/Manila'); // unchanged
    assert.equal(next.telemetryEnabled, true); // unchanged
  });

  await t.test('empty record → current settings unchanged', () => {
    const current = {
      taxRate: 0.12,
      currency: 'PHP',
      timezone: 'Asia/Manila',
      telemetryEnabled: false,
    };
    const next = recordToSettings({}, current);
    assert.deepEqual(next, current);
  });

  await t.test('ignores camelCase keys (post-#17 wire shape is snake_case only)', () => {
    const current = {
      taxRate: 0.12,
      currency: 'PHP',
      timezone: 'Asia/Manila',
      telemetryEnabled: true,
    };
    const next = recordToSettings(
      // bug-shape probe — these keys must not leak through
      { taxRate: '99.000', timeZone: 'America/Los_Angeles', telemetryEnabled: false },
      current,
    );
    assert.deepEqual(next, current);
  });

  await t.test('telemetry_enabled toggles independently', () => {
    const current = {
      taxRate: 0.12,
      currency: 'PHP',
      timezone: 'UTC',
      telemetryEnabled: true,
    };
    const off = recordToSettings({ telemetry_enabled: false }, current);
    assert.equal(off.telemetryEnabled, false);
    assert.equal(off.taxRate, 0.12); // other fields untouched
    const on = recordToSettings({ telemetry_enabled: true }, off);
    assert.equal(on.telemetryEnabled, true);
  });
});
