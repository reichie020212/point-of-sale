/**
 * useLoyalty — observe active loyalty programs + the active customer's
 * outstanding punches, then compute auto-redemptions for the current
 * cart.
 *
 * Reactive: a punch arriving via broker fan-out (e.g. another register
 * just rang up the customer's 9th coffee) updates the cart's redemption
 * preview without a manual refresh.
 *
 * Returns:
 *   - `programs`: the active programs (filtered out archived).
 *   - `applied`: `pickRedemptions` output for the supplied cart lines.
 *   - `discountCents`: convenience sum of `applied`.
 *   - `earnedPunches`: post-checkout punch entries per qualifying unit.
 */
import { Q } from '@nozbe/watermelondb';
import { useEffect, useMemo, useState } from 'react';

import { database } from '../db';
import {
  availableRedemptions,
  earnedPunchesByProgram,
  loyaltyDiscountCents,
  pickRedemptions,
  type CartLineSnapshot,
  type LoyaltyProgramSnapshot,
} from '../state/loyalty-helpers';

import type { LoyaltyProgram as LoyaltyProgramModel } from '../db/models/LoyaltyProgram';
import type { LoyaltyPunch as LoyaltyPunchModel } from '../db/models/LoyaltyPunch';

export interface UseLoyaltyArgs {
  customerId: string | null;
  cartLines: CartLineSnapshot[];
}

export interface UseLoyaltyResult {
  programs: LoyaltyProgramSnapshot[];
  applied: ReturnType<typeof pickRedemptions>;
  discountCents: number;
  /** Per-program punch credits available to the customer right now. */
  credits: Record<string, number>;
  /** Earned punches the *next* checkout will create. */
  earnedPunches: { programId: string; lineId: string }[];
}

export function useLoyalty({ customerId, cartLines }: UseLoyaltyArgs): UseLoyaltyResult {
  const [programs, setPrograms] = useState<LoyaltyProgramSnapshot[]>([]);
  const [earned, setEarned] = useState<Record<string, number>>({});
  const [redeemed, setRedeemed] = useState<Record<string, number>>({});

  // Programs subscription — independent of customer.
  useEffect(() => {
    const col = database.get<LoyaltyProgramModel>('loyalty_programs');
    const sub = col
      .query(Q.where('status', 'active'))
      .observeWithColumns(['name', 'target_type', 'target_id', 'threshold', 'status'])
      .subscribe((rows) => {
        setPrograms(
          rows
            .filter((r) => r.targetType === 'product' || r.targetType === 'category')
            .map<LoyaltyProgramSnapshot>((r) => ({
              id: r.serverId,
              targetType: r.targetType as 'product' | 'category',
              targetId: r.targetId,
              threshold: r.threshold,
              status: 'active',
            })),
        );
      });
    return () => sub.unsubscribe();
  }, []);

  // Punches subscription — re-keyed when the customer changes.
  useEffect(() => {
    if (!customerId) {
      setEarned({});
      setRedeemed({});
      return;
    }
    const col = database.get<LoyaltyPunchModel>('loyalty_punches');
    const sub = col
      .query(Q.where('customer_id', customerId))
      .observeWithColumns(['is_redemption'])
      .subscribe((rows) => {
        const e: Record<string, number> = {};
        const r: Record<string, number> = {};
        for (const row of rows) {
          const target = row.isRedemption ? r : e;
          target[row.programId] = (target[row.programId] ?? 0) + 1;
        }
        setEarned(e);
        setRedeemed(r);
      });
    return () => sub.unsubscribe();
  }, [customerId]);

  const credits = useMemo(
    () => availableRedemptions(programs, earned, redeemed),
    [programs, earned, redeemed],
  );
  const applied = useMemo(
    () => pickRedemptions(cartLines, programs, credits),
    [cartLines, programs, credits],
  );
  const discountCents = useMemo(() => loyaltyDiscountCents(applied), [applied]);
  const earnedPunches = useMemo(
    () => earnedPunchesByProgram(cartLines, programs, applied),
    [cartLines, programs, applied],
  );

  return { programs, applied, discountCents, credits, earnedPunches };
}
