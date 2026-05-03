import { nativeTheme } from '@counter/tokens/native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Money } from '../src/components/Money';
import { track } from '../src/observability/funnel';
import { useCart } from '../src/state/cart';
import { parseTipInputCents } from '../src/state/tip-input';

/** Cart screen. Full swipe-to-remove + qty stepper lands in M5. */
export default function CartScreen() {
  const lines = useCart((s) => s.lines);
  const subtotal = useCart((s) => s.subtotalCents());
  const tipCents = useCart((s) => s.tipCents);
  const setTip = useCart((s) => s.setTip);

  const [tipModalOpen, setTipModalOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Cart</Text>
      {lines.length === 0 ? (
        <Text style={styles.empty}>Empty cart. Tap a product on the Sell screen to add.</Text>
      ) : (
        lines.map((line) => (
          <View key={line.lineId} style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineName}>{line.nameSnapshot}</Text>
              <Text style={styles.lineQty}>×{line.qty}</Text>
            </View>
            <Money cents={line.qty * line.unitPriceCents} />
          </View>
        ))
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Subtotal</Text>
        <Money cents={subtotal} style={styles.totalAmount} />
      </View>

      {/* §9 fixed-amount tipping. No percent presets. */}
      <Pressable
        disabled={lines.length === 0}
        onPress={() => setTipModalOpen(true)}
        style={[styles.tipRow, lines.length === 0 && styles.disabled]}
      >
        <Text style={styles.tipLabel}>{tipCents > 0 ? 'Tip' : 'Add tip'}</Text>
        {tipCents > 0 ? (
          <Money cents={tipCents} />
        ) : (
          <Text style={styles.tipHint}>Optional</Text>
        )}
      </Pressable>

      <Pressable
        disabled={lines.length === 0}
        style={[styles.checkout, lines.length === 0 && styles.disabled]}
        onPress={() => router.push('/payment')}
      >
        <Text style={styles.checkoutText}>Charge</Text>
      </Pressable>

      <TipModal
        open={tipModalOpen}
        initialCents={tipCents}
        onClose={() => setTipModalOpen(false)}
        onSubmit={(cents) => {
          setTip(cents);
          setTipModalOpen(false);
          if (cents > 0) track('tip_added', { amountCents: cents });
        }}
      />
    </View>
  );
}

interface TipModalProps {
  open: boolean;
  initialCents: number;
  onClose: () => void;
  onSubmit: (cents: number) => void;
}

function TipModal({ open, initialCents, onClose, onSubmit }: TipModalProps) {
  const [draft, setDraft] = useState(initialCents > 0 ? (initialCents / 100).toFixed(2) : '');
  const parsed = parseTipInputCents(draft);
  const canSubmit = parsed !== null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => setDraft(initialCents > 0 ? (initialCents / 100).toFixed(2) : '')}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Add tip</Text>
          <Text style={styles.sheetHint}>Enter the cash tip amount.</Text>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Tip</Text>
            <Money cents={parsed ?? 0} style={styles.previewAmount} />
          </View>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="0.00"
            placeholderTextColor={nativeTheme.colors.ink3}
            keyboardType="decimal-pad"
            autoFocus
            accessibilityLabel="Tip amount"
          />
          <View style={styles.sheetActions}>
            <Pressable
              style={styles.clear}
              onPress={() => onSubmit(0)}
              accessibilityLabel="Clear tip"
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
            <Pressable
              style={[styles.done, !canSubmit && styles.disabled]}
              onPress={() => parsed !== null && onSubmit(parsed)}
              disabled={!canSubmit}
              accessibilityLabel="Apply tip"
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 24, gap: 12 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600' },
  empty: { color: nativeTheme.colors.ink3, fontSize: 14 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: nativeTheme.colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: nativeTheme.colors.line,
  },
  lineName: { color: nativeTheme.colors.ink, fontSize: 14 },
  lineQty: { color: nativeTheme.colors.ink3, fontSize: 12 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: nativeTheme.colors.line,
  },
  totalLabel: { color: nativeTheme.colors.ink2, fontSize: 14 },
  totalAmount: { fontSize: 22 },
  tipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  tipLabel: { color: nativeTheme.colors.ink, fontSize: 14, fontWeight: '500' },
  tipHint: { color: nativeTheme.colors.ink3, fontSize: 12 },
  checkout: {
    backgroundColor: nativeTheme.colors.ink,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabled: { opacity: 0.4 },
  checkoutText: { color: nativeTheme.colors.bg, fontSize: 16, fontWeight: '600' },
  backdrop: {
    flex: 1,
    backgroundColor: nativeTheme.colors.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: nativeTheme.colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  sheetTitle: { color: nativeTheme.colors.ink, fontSize: 18, fontWeight: '600' },
  sheetHint: { color: nativeTheme.colors.ink2, fontSize: 13 },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  previewLabel: { color: nativeTheme.colors.ink2, fontSize: 14 },
  previewAmount: { fontSize: 24 },
  input: {
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: nativeTheme.colors.ink,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  clear: {
    flex: 1,
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line2,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  clearText: { color: nativeTheme.colors.ink2, fontSize: 14, fontWeight: '500' },
  done: {
    flex: 1,
    backgroundColor: nativeTheme.colors.ink,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  doneText: { color: nativeTheme.colors.bg, fontSize: 14, fontWeight: '600' },
});
