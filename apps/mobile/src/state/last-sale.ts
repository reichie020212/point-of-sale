/**
 * Holds the most-recently-finalised sale so the receipt screen can
 * display it. Populated by the payment screen on a successful charge,
 * cleared when the user starts a New Sale.
 */
import { create } from 'zustand';

import type { ReceiptItem, ReceiptOrder } from '@counter/printers';

export interface LastSale {
  order: ReceiptOrder;
  items: ReceiptItem[];
}

interface State {
  sale: LastSale | null;
  set: (sale: LastSale) => void;
  clear: () => void;
}

export const useLastSale = create<State>((set) => ({
  sale: null,
  set: (sale) => set({ sale }),
  clear: () => set({ sale: null }),
}));
