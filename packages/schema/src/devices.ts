/**
 * Devices + shifts.
 *
 * `devices` is the paired-hardware registry that replaces the W1
 * "session = device" approximation. A pairing flow generates a
 * 12-char `CNTR-XXXX-XXXX` code (HANDOFF §3); the mobile app exchanges
 * it for a device token. `status` plus `lastSeenAt` drive the live
 * registers card on the dashboard.
 *
 * `shifts` track register openings/closings: opening cash, closing
 * cash, variance. Cash counts are integers in cents.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations, users } from './auth';

export const deviceStatus = pgEnum('device_status', ['live', 'offline', 'revoked']);

export const devices = pgTable(
  'devices',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    model: text('model'),
    /** Most-recent IP observed by the sync server. */
    lastIp: text('last_ip'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    /**
     * Highest org Lamport version this device has acknowledged seeing
     * (PULL cursor on HELLO, plus the post-PUSH org version after each
     * accepted batch). Used by `/api/v1/sync/status` to compute the
     * device's current sync lag without per-row math.
     */
    lastSeenVersion: bigint('last_seen_version', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    status: deviceStatus('status').notNull().default('offline'),
    /** Format: CNTR-XXXX-XXXX, 5-minute TTL during pairing flow. */
    pairingCode: text('pairing_code'),
    pairingExpiresAt: timestamp('pairing_expires_at', { withTimezone: true }),
    /** Hashed device token; cleared on revoke. */
    tokenHash: text('token_hash'),
    version: bigint('version', { mode: 'bigint' }).notNull().default(sql`0`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    orgIdx: index('devices_org_id_idx').on(table.orgId),
    statusIdx: index('devices_status_idx').on(table.orgId, table.status),
    pairingCodeIdx: index('devices_pairing_code_idx').on(table.pairingCode),
    versionIdx: index('devices_org_version_idx').on(table.orgId, table.version),
  }),
);

export const shifts = pgTable(
  'shifts',
  {
    id: uuid('id')
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    /** Cash in drawer at open, in cents. */
    openingCashCents: integer('opening_cash_cents').notNull(),
    /** Cash in drawer at close, in cents. Null until shift closes. */
    closingCashCents: integer('closing_cash_cents'),
    /** Closing - opening - net cash sales. Set at close. */
    varianceCents: integer('variance_cents'),
    version: bigint('version', { mode: 'bigint' }).notNull().default(sql`0`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    orgIdx: index('shifts_org_id_idx').on(table.orgId),
    deviceIdx: index('shifts_device_idx').on(table.deviceId),
    openedAtIdx: index('shifts_opened_at_idx').on(table.orgId, table.openedAt),
    versionIdx: index('shifts_org_version_idx').on(table.orgId, table.version),
  }),
);

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
export type DeviceStatus = (typeof deviceStatus.enumValues)[number];
