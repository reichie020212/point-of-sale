/**
 * useCustomers — observe the local Watermelon customer roster.
 *
 * A `query` argument trims the list by name/email/phone substring; the
 * filter happens in memory after the observable fires so callers can
 * type freely without resubscribing on every keystroke.
 */
import { useEffect, useMemo, useState } from 'react';

import { database } from '../db';

import type { Customer as CustomerModel } from '../db/models/Customer';

export interface CustomerSummary {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  loyaltyPoints: number;
}

export function useCustomers(query = '') {
  const [all, setAll] = useState<CustomerModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const collection = database.get<CustomerModel>('customers');
    const sub = collection
      .query()
      .observeWithColumns(['name', 'email', 'phone', 'loyalty_points', 'deleted_at'])
      .subscribe((rows) => {
        setAll(rows);
        setLoading(false);
      });
    return () => sub.unsubscribe();
  }, []);

  const customers = useMemo<CustomerSummary[]>(() => {
    const needle = query.trim().toLowerCase();
    const summaries = all
      .filter((c) => !c.deletedAt)
      .map<CustomerSummary>((c) => ({
        id: c.serverId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        loyaltyPoints: c.loyaltyPoints,
      }));
    summaries.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    if (!needle) return summaries;
    return summaries.filter((c) => {
      const haystack = `${c.name ?? ''} ${c.email ?? ''} ${c.phone ?? ''}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [all, query]);

  return { customers, loading };
}
