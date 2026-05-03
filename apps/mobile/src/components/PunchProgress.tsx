/**
 * PunchProgress — visualises a customer's punchcard progress for every
 * active loyalty program.
 *
 * Reactive: subscribes to active programs + the customer's punches. A
 * sale (or a refund tombstone) on another device updates the count
 * here without a manual refresh.
 *
 * Behaviour:
 *   - Skipped entirely when no active program matches.
 *   - Each program renders one row: program name + "N / threshold".
 *   - When N == threshold the row reads "Free next visit!" — a hint
 *     to the cashier that a redemption is queued for the customer's
 *     next qualifying purchase.
 *
 * Density: kept compact so it can sit inline in a customer-list row
 * or in an order-detail card.
 */
import { nativeTheme } from '@counter/tokens/native';
import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { database } from '../db';
import { progressTowardNext as progressTowardNextHelper } from '../state/loyalty-helpers';

import type { LoyaltyProgram as LoyaltyProgramModel } from '../db/models/LoyaltyProgram';
import type { LoyaltyPunch as LoyaltyPunchModel } from '../db/models/LoyaltyPunch';

interface ProgramRow {
  id: string;
  name: string;
  threshold: number;
}

export interface PunchProgressProps {
  customerId: string | null;
  /** Compact ('row' inline) vs default ('list' stacked). */
  variant?: 'row' | 'list';
}

interface ProgressRow {
  programId: string;
  programName: string;
  threshold: number;
  /** floor(earned / threshold) - redeemed; the credits readily redeemable. */
  available: number;
  /** Raw earned-not-redeemed count, for the "N / threshold" display. */
  progressTowardNext: number;
}

export function PunchProgress({ customerId, variant = 'list' }: PunchProgressProps) {
  const [rows, setRows] = useState<ProgressRow[]>([]);

  useEffect(() => {
    if (!customerId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    let punchesSub: { unsubscribe(): void } | null = null;
    let lastPrograms: ProgramRow[] = [];

    const programsCol = database.get<LoyaltyProgramModel>('loyalty_programs');
    const punchesCol = database.get<LoyaltyPunchModel>('loyalty_punches');

    const programsSub = programsCol
      .query(Q.where('status', 'active'))
      .observeWithColumns(['name', 'threshold', 'status'])
      .subscribe((progRows) => {
        if (cancelled) return;
        lastPrograms = progRows.map<ProgramRow>((p) => ({
          id: p.serverId,
          name: p.name,
          threshold: p.threshold,
        }));
        // Re-subscribe punches keyed to the customer; the punches
        // observer fires synchronously with current state, so we get
        // a fresh recompute even if no punches change.
        punchesSub?.unsubscribe();
        punchesSub = punchesCol
          .query(Q.where('customer_id', customerId))
          .observeWithColumns(['is_redemption'])
          .subscribe((punchRows) => {
            if (cancelled) return;
            recompute(lastPrograms, punchRows);
          });
      });

    function recompute(programs: ProgramRow[], punches: LoyaltyPunchModel[]) {
      const earnedByProgram: Record<string, number> = {};
      const redeemedByProgram: Record<string, number> = {};
      for (const p of punches) {
        const target = p.isRedemption ? redeemedByProgram : earnedByProgram;
        target[p.programId] = (target[p.programId] ?? 0) + 1;
      }
      const next: ProgressRow[] = [];
      for (const program of programs) {
        if (program.threshold <= 0) continue;
        const earned = earnedByProgram[program.id] ?? 0;
        const redeemed = redeemedByProgram[program.id] ?? 0;
        const available = Math.max(0, Math.floor(earned / program.threshold) - redeemed);
        const progressTowardNext = progressTowardNextHelper(
          earned,
          redeemed,
          program.threshold,
        );
        // Skip programs the customer has never earned a punch for —
        // saves screen real estate when the merchant runs many programs.
        if (earned === 0 && redeemed === 0) continue;
        next.push({
          programId: program.id,
          programName: program.name,
          threshold: program.threshold,
          available,
          progressTowardNext,
        });
      }
      setRows(next);
    }

    return () => {
      cancelled = true;
      programsSub.unsubscribe();
      punchesSub?.unsubscribe();
    };
  }, [customerId]);

  if (!customerId || rows.length === 0) return null;

  if (variant === 'row') {
    return (
      <View style={styles.rowContainer}>
        {rows.map((r) => (
          <Text key={r.programId} style={styles.rowChip}>
            {r.programName}: {r.available > 0 ? '★' : `${r.progressTowardNext}/${r.threshold}`}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      {rows.map((r) => {
        const ready = r.available > 0;
        return (
          <View key={r.programId} style={styles.listRow}>
            <Text style={styles.listName}>{r.programName}</Text>
            <Text style={[styles.listValue, ready && styles.listValueReady]}>
              {ready
                ? `${r.available} free ready`
                : `${r.progressTowardNext} / ${r.threshold}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rowContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  rowChip: {
    color: nativeTheme.colors.ink2,
    fontSize: 11,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
    backgroundColor: nativeTheme.colors.surface2,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  listContainer: { gap: 6 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listName: { color: nativeTheme.colors.ink2, fontSize: 13 },
  listValue: {
    color: nativeTheme.colors.ink2,
    fontSize: 13,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  listValueReady: { color: nativeTheme.colors.accentDeep, fontWeight: '600' as const },
});
