/**
 * Cart state — the in-flight sale on a single register.
 *
 * Lives in Zustand (not WatermelonDB) because the cart is ephemeral
 * until checkout. On payment, an immutable order row is written to
 * the local DB and replicated via the sync queue.
 *
 * Money in cents only.
 */
import { create } from 'zustand';

export interface CartLine {
  /** Stable client-generated id; survives the sale. */
  lineId: string;
  variantId: string;
  productId: string;
  nameSnapshot: string;
  unitPriceCents: number;
  qty: number;
  modifiers: Array<{ id: string; name: string; priceCents: number }>;
}

export interface CartState {
  lines: CartLine[];
  customerId: string | null;
  /** Discount applied to the whole sale (cents). Per-line discount = future. */
  discountCents: number;
  tipCents: number;
  add: (line: Omit<CartLine, 'lineId' | 'qty'> & { qty?: number }) => void;
  setQty: (lineId: string, qty: number) => void;
  remove: (lineId: string) => void;
  setCustomer: (customerId: string | null) => void;
  setDiscount: (cents: number) => void;
  setTip: (cents: number) => void;
  clear: () => void;
  subtotalCents: () => number;
}

let lineCounter = 0;
const nextLineId = () => `line_${Date.now().toString(36)}_${(lineCounter++).toString(36)}`;

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  customerId: null,
  discountCents: 0,
  tipCents: 0,

  add: (line) =>
    set((state) => {
      // De-dupe identical variant + same modifiers by bumping qty.
      const modKey = line.modifiers
        .map((m) => m.id)
        .sort()
        .join(',');
      const existing = state.lines.find(
        (l) =>
          l.variantId === line.variantId &&
          l.modifiers
            .map((m) => m.id)
            .sort()
            .join(',') === modKey,
      );
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.lineId === existing.lineId ? { ...l, qty: l.qty + (line.qty ?? 1) } : l,
          ),
        };
      }
      return {
        lines: [
          ...state.lines,
          { ...line, qty: line.qty ?? 1, lineId: nextLineId() },
        ],
      };
    }),

  setQty: (lineId, qty) =>
    set((state) => ({
      lines:
        qty <= 0
          ? state.lines.filter((l) => l.lineId !== lineId)
          : state.lines.map((l) => (l.lineId === lineId ? { ...l, qty } : l)),
    })),

  remove: (lineId) =>
    set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),

  setCustomer: (customerId) => set({ customerId }),
  setDiscount: (cents) => set({ discountCents: Math.max(0, Math.round(cents)) }),
  setTip: (cents) => set({ tipCents: Math.max(0, Math.round(cents)) }),

  clear: () => set({ lines: [], customerId: null, discountCents: 0, tipCents: 0 }),

  subtotalCents: () => {
    const lines = get().lines;
    return lines.reduce((sum, l) => {
      const modSum = l.modifiers.reduce((m, x) => m + x.priceCents, 0);
      return sum + l.qty * (l.unitPriceCents + modSum);
    }, 0);
  },
}));
