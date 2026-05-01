// Cart screen — line items (swipe to remove), discounts, totals, checkout CTA

const CartScreen = ({ t, lines, setLines, discount, setDiscount, customer, setCustomerPick, onClose, onCheckout, onPark }) => {
  const subtotal = lines.reduce((s, l) => s + (l.unit + l.modTotal) * l.qty, 0);
  const discountAmt = discount.type === 'pct'
    ? subtotal * (discount.value / 100)
    : Math.min(discount.value, subtotal);
  const tax = (subtotal - discountAmt) * 0.08;
  const total = subtotal - discountAmt + tax;
  const [showDiscount, setShowDiscount] = React.useState(false);

  const updateQty = (id, q) => {
    if (q < 1) setLines(lines.filter(l => l.id !== id));
    else setLines(lines.map(l => l.id === id ? { ...l, qty: q } : l));
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 90, background: t.bg,
      display: 'flex', flexDirection: 'column',
      animation: 'slideUpFull 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)',
    }}>
      <CounterStatusBar t={t}/>
      <NavBar t={t} title="Order" large={true}
        subtitle={`${lines.reduce((s,l)=>s+l.qty,0)} item${lines.length !== 1 ? 's' : ''} · ${customer ? customer.name : 'Walk-in'}`}
        leading={
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 12, border: 'none',
            background: t.surface2, color: t.ink, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon.chevronDown width="20" height="20"/></button>
        }
        trailing={lines.length > 0 && <button onClick={onPark} style={{
            height: 36, padding: '0 12px', borderRadius: 12, border: 'none',
            background: t.surface2, color: t.ink, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: t.fontUI,
          }}>Park</button>}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 16px 20px' }}>
        {/* Customer row */}
        <button onClick={setCustomerPick} style={{
          width: '100%', padding: '12px 14px', borderRadius: 14,
          background: t.surface, border: `0.5px solid ${t.line}`,
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          textAlign: 'left', marginBottom: 12, fontFamily: t.fontUI,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 18,
            background: customer ? t.accentSoft : t.surface2,
            color: customer ? t.accentDeep : t.ink3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon.user width="18" height="18"/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>
              {customer ? customer.name : 'Add customer'}
            </div>
            {customer && (
              <div style={{ fontSize: 11, color: t.ink3, fontFamily: t.fontMono, marginTop: 2 }}>
                {customer.loyalty} pts · {customer.visits} visits
              </div>
            )}
          </div>
          <Icon.chevron width="16" height="16" style={{ color: t.ink3 }}/>
        </button>

        {/* Lines */}
        {lines.length === 0 ? (
          <div style={{
            padding: '60px 20px', textAlign: 'center', color: t.ink3,
            border: `0.5px dashed ${t.line2}`, borderRadius: 18, marginTop: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.ink2, marginBottom: 4 }}>No items yet</div>
            <div style={{ fontSize: 12 }}>Tap products to add them to this order.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lines.map(line => <CartLine key={line.id} t={t} line={line}
              onUpdate={(q) => updateQty(line.id, q)}
              onRemove={() => updateQty(line.id, 0)}
            />)}
          </div>
        )}

        {/* Discount row */}
        {lines.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <button onClick={() => setShowDiscount(!showDiscount)} style={{
              width: '100%', padding: '12px 14px', borderRadius: 14,
              background: discount.value > 0 ? t.accentSoft : t.surface,
              border: `0.5px solid ${discount.value > 0 ? t.accent : t.line}`,
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              textAlign: 'left', fontFamily: t.fontUI,
            }}>
              <Icon.discount width="18" height="18" style={{ color: t.accentDeep }}/>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.ink }}>
                {discount.value > 0
                  ? (discount.type === 'pct' ? `${discount.value}% off order` : `$${discount.value} off order`)
                  : 'Add order discount'}
              </span>
              {discount.value > 0 && (
                <span style={{ fontFamily: t.fontMono, fontSize: 13, color: t.accentDeep, fontWeight: 600 }}>
                  −${discountAmt.toFixed(2)}
                </span>
              )}
            </button>
            {showDiscount && (
              <div style={{
                marginTop: 8, padding: 12, borderRadius: 14, background: t.surface,
                border: `0.5px solid ${t.line}`,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[0, 5, 10, 15, 20].map(v => (
                    <button key={v} onClick={() => setDiscount({ type: 'pct', value: v })} style={{
                      flex: 1, padding: '10px 0', borderRadius: 10,
                      border: `1px solid ${discount.type === 'pct' && discount.value === v ? t.ink : t.line2}`,
                      background: discount.type === 'pct' && discount.value === v ? t.ink : 'transparent',
                      color: discount.type === 'pct' && discount.value === v ? t.bg : t.ink2,
                      fontFamily: t.fontUI, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>{v}%</button>
                  ))}
                </div>
                <button onClick={() => setDiscount({ type: 'pct', value: 0 })}
                  style={{ padding: 8, border: 'none', background: 'transparent',
                    color: t.ink3, fontSize: 12, cursor: 'pointer', fontFamily: t.fontUI }}>
                  Clear discount
                </button>
              </div>
            )}
          </div>
        )}

        {/* Totals */}
        {lines.length > 0 && (
          <div style={{
            marginTop: 16, padding: '14px 16px', borderRadius: 16, background: t.surface,
            border: `0.5px solid ${t.line}`, fontFamily: t.fontMono,
          }}>
            {[
              { label: 'Subtotal', val: subtotal, mono: true },
              ...(discountAmt > 0 ? [{ label: 'Discount', val: -discountAmt, mono: true, accent: true }] : []),
              { label: 'Tax (8%)', val: tax, mono: true },
            ].map(r => (
              <div key={r.label} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '4px 0', fontSize: 13, color: r.accent ? t.accentDeep : t.ink2,
              }}>
                <span style={{ fontFamily: t.fontUI }}>{r.label}</span>
                <span>{r.val < 0 ? '−' : ''}${Math.abs(r.val).toFixed(2)}</span>
              </div>
            ))}
            <div style={{
              marginTop: 8, paddingTop: 10, borderTop: `0.5px solid ${t.line}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: t.fontUI }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: t.ink }}>${total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Checkout CTA */}
      {lines.length > 0 && (
        <div style={{
          padding: '12px 16px 28px', background: t.bg,
          borderTop: `0.5px solid ${t.line}`,
        }}>
          <button onClick={onCheckout} style={{
            width: '100%', height: 56, borderRadius: 16, border: 'none',
            background: t.ink, color: t.bg, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 22px', fontFamily: t.fontUI, fontSize: 17, fontWeight: 600,
          }}>
            <span>Charge</span>
            <span style={{ fontFamily: t.fontMono }}>${total.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
};

const CartLine = ({ t, line, onUpdate, onRemove }) => {
  const [drag, setDrag] = React.useState(0);
  const [start, setStart] = React.useState(null);
  const variantText = line.selected ? Object.values(line.selected).join(' · ') : '';
  const modsText = Object.entries(line.mods || {}).filter(([,v]) => v).map(([k]) => k).join(', ');

  const onStart = (e) => setStart(e.touches ? e.touches[0].clientX : e.clientX);
  const onMove = (e) => {
    if (start == null) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    setDrag(Math.min(0, Math.max(-100, x - start)));
  };
  const onEnd = () => {
    if (drag < -70) onRemove();
    else setDrag(0);
    setStart(null);
  };

  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
      {/* delete bg */}
      <div style={{
        position: 'absolute', inset: 0, background: '#D84C3F',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '0 20px', color: '#fff', gap: 6, fontFamily: t.fontUI, fontSize: 13, fontWeight: 600,
      }}>
        <Icon.trash width="18" height="18"/>
        Remove
      </div>

      <div onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        style={{
          padding: 12, background: t.surface,
          border: `0.5px solid ${t.line}`, borderRadius: 14,
          display: 'flex', gap: 12, alignItems: 'center',
          transform: `translateX(${drag}px)`,
          transition: start == null ? 'transform 0.2s' : 'none',
          userSelect: 'none',
      }}>
        <ProductThumb product={line.product} size={48} radius={10}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.ink, lineHeight: 1.3 }}>
            {line.product.name}
          </div>
          {(variantText || modsText) && (
            <div style={{ fontSize: 11, color: t.ink3, fontFamily: t.fontUI, marginTop: 2, lineHeight: 1.3 }}>
              {variantText}{variantText && modsText ? ' · ' : ''}{modsText}
            </div>
          )}
          <div style={{ marginTop: 4, fontSize: 12, color: t.ink2, fontFamily: t.fontMono }}>
            ${(line.unit + line.modTotal).toFixed(2)} each
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 14, fontWeight: 700, color: t.ink }}>
            ${((line.unit + line.modTotal) * line.qty).toFixed(2)}
          </div>
          <QtyStepper t={t} value={line.qty} onChange={onUpdate} size="sm"/>
        </div>
      </div>
    </div>
  );
};

window.CartScreen = CartScreen;
