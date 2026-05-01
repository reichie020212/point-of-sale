// Receipt/success + thermal printer preview (58mm)

const ReceiptScreen = ({ t, order, onDone, onNewSale }) => {
  const [showThermal, setShowThermal] = React.useState(false);
  const [printed, setPrinted] = React.useState(false);
  const [emailed, setEmailed] = React.useState(false);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 95, background: t.bg,
      display: 'flex', flexDirection: 'column',
      animation: 'fadeIn 0.3s ease',
    }}>
      <CounterStatusBar t={t}/>

      {/* Success hero */}
      <div style={{ padding: '20px 20px 14px', textAlign: 'center' }}>
        <div style={{
          margin: '12px auto 14px', width: 76, height: 76, borderRadius: 38,
          background: t.accentSoft, color: t.accentDeep,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'popIn 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.2)',
        }}>
          <Icon.check width="40" height="40"/>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: t.ink, letterSpacing: -0.4 }}>Paid</div>
        <div style={{ fontFamily: t.fontMono, fontSize: 15, color: t.ink3, marginTop: 4 }}>
          ${order.total.toFixed(2)} · {order.method}{order.method === 'Cash' ? ` · Change $${(order.tendered - order.total).toFixed(2)}` : ''}
        </div>
        <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink3, marginTop: 8, letterSpacing: 1 }}>
          #{order.id}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '6px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ReceiptAction t={t} icon={Icon.printer}
          label={printed ? 'Reprint thermal receipt' : 'Print thermal receipt'}
          meta="Star TSP143 · Bluetooth"
          checked={printed}
          onClick={() => { setPrinted(true); setShowThermal(true); }}
        />
        <ReceiptAction t={t} icon={Icon.receipt} label="Email receipt" meta={order.customer?.email || 'Add customer email'}
          checked={emailed} onClick={() => order.customer && setEmailed(true)}/>
        <ReceiptAction t={t} icon={Icon.qr} label="Text receipt" meta="Send via SMS"/>
      </div>

      <div style={{ flex: 1 }}/>

      <div style={{ padding: '12px 16px 28px', display: 'flex', gap: 8 }}>
        <button onClick={onDone} style={{
          flex: 1, height: 52, borderRadius: 14, border: `1px solid ${t.line2}`,
          background: 'transparent', color: t.ink, cursor: 'pointer',
          fontFamily: t.fontUI, fontSize: 15, fontWeight: 600,
        }}>Done</button>
        <button onClick={onNewSale} style={{
          flex: 1.4, height: 52, borderRadius: 14, border: 'none',
          background: t.ink, color: t.bg, cursor: 'pointer',
          fontFamily: t.fontUI, fontSize: 15, fontWeight: 600,
        }}>New sale</button>
      </div>

      {showThermal && <ThermalPreview t={t} order={order} onClose={() => setShowThermal(false)}/>}
    </div>
  );
};

const ReceiptAction = ({ t, icon: Ic, label, meta, checked, onClick }) => (
  <button onClick={onClick} style={{
    padding: 14, borderRadius: 14, border: `0.5px solid ${t.line}`,
    background: t.surface, display: 'flex', alignItems: 'center', gap: 12,
    cursor: 'pointer', textAlign: 'left', fontFamily: t.fontUI,
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: 12,
      background: checked ? t.accentSoft : t.surface2,
      color: checked ? t.accentDeep : t.ink2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}><Ic width="20" height="20"/></div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{label}</div>
      <div style={{ fontSize: 11.5, color: t.ink3, marginTop: 2 }}>{meta}</div>
    </div>
    {checked && <Icon.check width="18" height="18" style={{ color: t.accentDeep }}/>}
  </button>
);

// 58mm thermal paper preview (~220px wide, monospace)
const ThermalPreview = ({ t, order, onClose }) => {
  const rowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: 11, lineHeight: 1.6 };
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 110,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'fadeIn 0.2s',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 280, maxHeight: '90%', overflow: 'auto',
        background: '#F9F6EF', color: '#1a1a1a', padding: '20px 18px 30px',
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), 97% 100%, 93% calc(100% - 6px), 88% 100%, 83% calc(100% - 6px), 78% 100%, 73% calc(100% - 6px), 68% 100%, 63% calc(100% - 6px), 58% 100%, 53% calc(100% - 6px), 48% 100%, 43% calc(100% - 6px), 38% 100%, 33% calc(100% - 6px), 28% 100%, 23% calc(100% - 6px), 18% 100%, 13% calc(100% - 6px), 8% 100%, 3% calc(100% - 6px), 0 100%)',
        animation: 'slideUp 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>COUNTER</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>124 Field St · Register 01</div>
          <div style={{ fontSize: 10 }}>Ana M. · 21 Apr 2026 · 14:32</div>
        </div>
        <div style={{ borderTop: '1px dashed #666', margin: '6px 0 8px' }}/>
        <div style={rowStyle}><span>ORDER</span><span>#{order.id}</span></div>
        {order.customer && <div style={rowStyle}><span>CUSTOMER</span><span>{order.customer.name}</span></div>}
        <div style={{ borderTop: '1px dashed #666', margin: '8px 0' }}/>
        {order.lines.map((l, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={rowStyle}>
              <span style={{ flex: 1 }}>{l.qty}× {l.product.name}</span>
              <span>${((l.unit + l.modTotal) * l.qty).toFixed(2)}</span>
            </div>
            {l.selected && Object.values(l.selected).length > 0 && (
              <div style={{ fontSize: 10, paddingLeft: 16, color: '#555' }}>
                {Object.values(l.selected).join(' · ')}
              </div>
            )}
            {Object.entries(l.mods || {}).filter(([,v]) => v).map(([k]) => (
              <div key={k} style={{ fontSize: 10, paddingLeft: 16, color: '#555' }}>+ {k}</div>
            ))}
          </div>
        ))}
        <div style={{ borderTop: '1px dashed #666', margin: '8px 0' }}/>
        <div style={rowStyle}><span>SUBTOTAL</span><span>${order.subtotal.toFixed(2)}</span></div>
        {order.discountAmt > 0 && <div style={rowStyle}><span>DISCOUNT</span><span>−${order.discountAmt.toFixed(2)}</span></div>}
        <div style={rowStyle}><span>TAX 8%</span><span>${order.tax.toFixed(2)}</span></div>
        <div style={{ ...rowStyle, fontWeight: 700, fontSize: 13, marginTop: 6 }}>
          <span>TOTAL</span><span>${order.total.toFixed(2)}</span>
        </div>
        <div style={{ borderTop: '1px dashed #666', margin: '8px 0' }}/>
        <div style={rowStyle}><span>{order.method.toUpperCase()}</span><span>${order.total.toFixed(2)}</span></div>
        {order.tendered && <>
          <div style={rowStyle}><span>TENDERED</span><span>${order.tendered.toFixed(2)}</span></div>
          <div style={rowStyle}><span>CHANGE</span><span>${(order.tendered - order.total).toFixed(2)}</span></div>
        </>}
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 10 }}>
          Thank you.
        </div>
        <div style={{ textAlign: 'center', marginTop: 4, fontSize: 8, letterSpacing: 0.3 }}>
          Counter · built by {DEVELOPER.name}
        </div>
        <div style={{ textAlign: 'center', fontSize: 8, letterSpacing: 0.3 }}>
          {DEVELOPER.website} · {DEVELOPER.email}
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <svg width="140" height="30" viewBox="0 0 140 30">
            {Array.from({ length: 45 }).map((_, i) => (
              <rect key={i} x={i * 3} y={0} width={Math.random() > 0.5 ? 2 : 1} height={30} fill="#1a1a1a"/>
            ))}
          </svg>
          <div style={{ fontSize: 9, marginTop: 2, letterSpacing: 1 }}>CT-{order.id}</div>
        </div>
      </div>
    </div>
  );
};

window.ReceiptScreen = ReceiptScreen;
