/**
 * Org-timezone helpers.
 *
 * The reports engine buckets sales in the shop's local timezone, not
 * UTC, so "Today" tracks the operator's calendar day. Postgres does
 * the heavy lifting via `date_trunc(field, source, time_zone)`; this
 * module owns the JS-side window math (the start/end timestamps for
 * the SQL `WHERE` clauses).
 *
 * No external dep — Node 20's `Intl.DateTimeFormat` knows every IANA
 * zone we'd ever ship.
 */

/**
 * Returns true when `tz` is an IANA name `Intl` accepts. The check
 * is constructive: an unknown zone makes the constructor throw.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The most-recent local-midnight in `tz` that is `<= now`, expressed
 * as a UTC `Date`. For `tz='America/New_York'` and a `now` of
 * 2026-05-02T12:00Z (08:00 EDT), this returns 2026-05-02T04:00Z
 * (= 00:00 EDT).
 */
export function startOfLocalDay(now: Date, tz: string): Date {
  const parts = wallClockParts(now, tz);
  // Build a UTC timestamp that has the *same wall-clock* components.
  // Subtracting `now` from this gives the active offset (positive in
  // east-of-UTC zones, negative in west).
  const wallAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const offsetMs = wallAsUtc - now.getTime();
  // The local midnight, interpreted as if it were UTC, then shifted
  // back by the same offset, yields the real UTC moment.
  const midnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  return new Date(midnightAsUtc - offsetMs);
}

/** Add (or subtract) whole days from a `Date` and return a new one. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClockParts(now: Date, tz: string): WallParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const out: Partial<WallParts> = {};
  for (const part of fmt.formatToParts(now)) {
    if (part.type === 'literal') continue;
    const value = Number(part.value);
    switch (part.type) {
      case 'year':
        out.year = value;
        break;
      case 'month':
        out.month = value;
        break;
      case 'day':
        out.day = value;
        break;
      case 'hour':
        // Some Node builds emit 24 for midnight; normalize.
        out.hour = value === 24 ? 0 : value;
        break;
      case 'minute':
        out.minute = value;
        break;
      case 'second':
        out.second = value;
        break;
      default:
        break;
    }
  }
  return out as WallParts;
}
