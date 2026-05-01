// Payment screen + number pad + split payment + receipt

const PaymentScreen = ({ t, total, onClose, onSuccess, lines }) => {
  const [step, setStep] = React.useState('method'); // method | cash | card | qr | split
  const [tendered, setTendered] = React.useState('');
  const [splits, setSplits] = React.useState([{ method: 'Card', amount: total / 2 }, { method: 'Cash', amount: total / 2 }]);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 95, background: t.bg,
      display: 'flex', flexDirection: 'column',
      animation: 'slideUpFull 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)',
    }}>
      <CounterStatusBar t={t}/>
      <NavBar t={t}
        title={step === 'method' ? 'Charge' : step === 'cash' ? 'Cash' : step === 'card' ? 'Card' : step === 'qr' ? 'QR Pay' : 'Split'}
        subtitle={step === 'method' ? `${lines.length} item${lines.length !== 1 ? 's' : ''} · Total due` : `Due: $${total.toFixed(2)}`}
        onBack={step === 'method' ? onClose : () => setStep('method')}
        large={true}
      />

      {step === 'method' && <MethodPicker t={t} total={total}
        onPick={(m) => setStep(m)}/>}

      {step === 'cash' && <CashFlow t={t} total={total}
        tendered={tendered} setTendered={setTendered}
        onConfirm={() => onSuccess({ method: 'Cash', tendered: parseFloat(tendered) || total })}/>}

      {step === 'card' && <CardFlow t={t} total={total} onConfirm={() => onSuccess({ method: 'Card' })}/>}

      {step === 'qr' && <QRFlow t={t} total={total} onConfirm={() => onSuccess({ method: 'QR' })}/>}

      {step === 'split' && <SplitFlow t={t} total={total} splits={splits} setSplits={setSplits}
        onConfirm={() => onSuccess({ method: 'Split', splits })}/>}
    </div>
  );
};

const MethodPicker = ({ t, total, onPick }) => {
  const methods = [
    { id: 'cash', label: 'Cash', icon: Icon.cash, note: 'Tender & give change' },
    { id: 'card', label: 'Card', icon: Icon.card, note: 'Tap, insert, or swipe' },
    { id: 'qr', label: 'QR Pay', icon: Icon.qr, note: 'Scan to pay · Wallet, bank' },
    { id: 'split', label: 'Split payment', icon: Icon.split, note: 'Multiple methods' },
  ];
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px 20px' }}>
      <div style={{
        padding: '20px 20px 22px', borderRadius: 20,
        background: t.ink, color: t.bg, marginBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      }}>
        <span style={{ fontSize: 13, opacity: 0.6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Total due</span>
        <span style={{ fontFamily: t.fontMono, fontSize: 34, fontWeight: 700 }}>${total.toFixed(2)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {methods.map(m => (
          <button key={m.id} onClick={() => onPick(m.id)} style={{
            padding: 14, borderRadius: 16, border: `0.5px solid ${t.line}`,
            background: t.surface, display: 'flex', alignItems: 'center', gap: 14,
            cursor: 'pointer', textAlign: 'left', fontFamily: t.fontUI,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: t.surface2,
              color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <m.icon width="22" height="22"/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>{m.label}</div>
              <div style={{ fontSize: 12, color: t.ink3, marginTop: 2 }}>{m.note}</div>
            </div>
            <Icon.chevron width="16" height="16" style={{ color: t.ink3 }}/>
          </button>
        ))}
      </div>
    </div>
  );
};

const NumberPad = ({ t, onTap, onBack, allowDot = true }) => {
  const keys = ['1','2','3','4','5','6','7','8','9', allowDot ? '.' : '', '0', 'back'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {keys.map((k, i) => {
        if (k === '') return <div key={i}/>;
        const isBack = k === 'back';
        return (
          <button key={k + i} onClick={() => isBack ? onBack() : onTap(k)} style={{
            height: 58, borderRadius: 14, border: 'none',
            background: t.surface, color: t.ink, cursor: 'pointer',
            fontFamily: t.fontMono, fontSize: 24, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            {isBack ? <svg width="22" height="18" viewBox="0 0 22 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2h12a2 2 0 012 2v10a2 2 0 01-2 2H7L1 9l6-7z"/><path d="M11 6l6 6M17 6l-6 6"/></svg> : k}
          </button>
        );
      })}
    </div>
  );
};

const CashFlow = ({ t, total, tendered, setTendered, onConfirm }) => {
  const numTendered = parseFloat(tendered) || 0;
  const change = numTendered - total;
  const quick = [total, Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20]
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);

  const append = (d) => {
    let s = tendered;
    if (d === '.' && s.includes('.')) return;
    s += d;
    setTendered(s);
  };
  const back = () => setTendered(tendered.slice(0, -1));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 16px 20px' }}>
      <div style={{ padding: '18px 20px', borderRadius: 18, background: t.surface, border: `0.5px solid ${t.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: t.ink3, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
          <span>Tendered</span>
          <span>Due ${total.toFixed(2)}</span>
        </div>
        <div style={{
          fontFamily: t.fontMono, fontSize: 38, fontWeight: 700, color: t.ink,
          minHeight: 48,
        }}>${tendered || '0.00'}</div>
        {numTendered >= total && (
          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 10,
            background: t.accentSoft, color: t.accentDeep,
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            fontFamily: t.fontUI, fontSize: 13, fontWeight: 600,
          }}>
            <span>Change due</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 18 }}>${change.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, margin: '10px 0 12px', flexWrap: 'wrap' }}>
        {quick.map(q => (
          <button key={q} onClick={() => setTendered(q.toFixed(2))} style={{
            flex: 1, padding: '10px 12px', borderRadius: 12, border: `1px solid ${t.line2}`,
            background: 'transparent', color: t.ink, cursor: 'pointer',
            fontFamily: t.fontMono, fontSize: 13, fontWeight: 600,
          }}>${q.toFixed(2)}</button>
        ))}
      </div>

      <NumberPad t={t} onTap={append} onBack={back}/>

      <button onClick={onConfirm} disabled={numTendered < total}
        style={{
          marginTop: 12, height: 56, borderRadius: 16, border: 'none',
          background: numTendered >= total ? t.ink : t.surface2,
          color: numTendered >= total ? t.bg : t.ink3,
          cursor: numTendered >= total ? 'pointer' : 'not-allowed',
          fontFamily: t.fontUI, fontSize: 16, fontWeight: 600,
        }}>
        {numTendered >= total ? `Confirm · Change $${change.toFixed(2)}` : `Tender at least $${total.toFixed(2)}`}
      </button>
    </div>
  );
};

const CardFlow = ({ t, total, onConfirm }) => {
  const [phase, setPhase] = React.useState('prompt'); // prompt | reading | done
  React.useEffect(() => {
    if (phase === 'reading') {
      const id = setTimeout(() => setPhase('done'), 1400);
      return () => clearTimeout(id);
    }
    if (phase === 'done') {
      const id = setTimeout(() => onConfirm(), 700);
      return () => clearTimeout(id);
    }
  }, [phase]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 30, textAlign: 'center' }}>
      <div style={{ position: 'relative', marginBottom: 30 }}>
        <div style={{
          width: 180, height: 180, borderRadius: 90,
          background: phase === 'done' ? t.accentSoft : t.surface,
          border: `0.5px solid ${t.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.3s',
        }}>
          {phase === 'done' ? (
            <Icon.check width="64" height="64" style={{ color: t.accentDeep }}/>
          ) : (
            <Icon.card width="64" height="64" style={{ color: t.ink2 }}/>
          )}
        </div>
        {phase === 'reading' && (
          <div style={{
            position: 'absolute', inset: -8, borderRadius: 100,
            border: `2px solid ${t.accent}`, borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite',
          }}/>
        )}
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, color: t.ink, marginBottom: 6 }}>
        {phase === 'prompt' && 'Tap or insert card'}
        {phase === 'reading' && 'Reading card…'}
        {phase === 'done' && 'Approved'}
      </div>
      <div style={{ fontFamily: t.fontMono, fontSize: 28, fontWeight: 700, color: t.ink, marginTop: 10 }}>
        ${total.toFixed(2)}
      </div>
      {phase === 'prompt' && (
        <button onClick={() => setPhase('reading')} style={{
          marginTop: 30, height: 52, padding: '0 36px', borderRadius: 16, border: 'none',
          background: t.ink, color: t.bg, cursor: 'pointer',
          fontFamily: t.fontUI, fontSize: 15, fontWeight: 600,
        }}>Simulate tap</button>
      )}
    </div>
  );
};

const QRFlow = ({ t, total, onConfirm }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: 30, textAlign: 'center' }}>
    <div style={{
      padding: 20, background: '#fff', borderRadius: 20,
      boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    }}>
      <QRCode size={200} seed="counter-pay"/>
    </div>
    <div style={{ marginTop: 24, fontSize: 18, fontWeight: 600, color: t.ink }}>Scan to pay</div>
    <div style={{ fontFamily: t.fontMono, fontSize: 28, fontWeight: 700, color: t.ink, marginTop: 8 }}>
      ${total.toFixed(2)}
    </div>
    <div style={{ marginTop: 6, fontSize: 12, color: t.ink3 }}>Waiting for confirmation…</div>
    <button onClick={onConfirm} style={{
      marginTop: 24, height: 48, padding: '0 30px', borderRadius: 14, border: 'none',
      background: t.surface, color: t.ink, cursor: 'pointer',
      fontFamily: t.fontUI, fontSize: 14, fontWeight: 600, border: `0.5px solid ${t.line}`,
    }}>Mark as paid</button>
  </div>
);

// fake QR
const QRCode = ({ size = 180, seed = 'x' }) => {
  const n = 21;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const rand = (i) => {
    h = (h * 9301 + 49297 + i * 233) % 233280;
    return h / 233280;
  };
  const cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const corner = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    const on = corner ? ((x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) && !(x === 7 || y === 7))
      : rand(y * n + x) > 0.5;
    if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#111"/>);
  }
  return <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>{cells}</svg>;
};

const SplitFlow = ({ t, total, splits, setSplits, onConfirm }) => {
  const paid = splits.reduce((s, x) => s + x.amount, 0);
  const remaining = total - paid;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 16px 20px' }}>
      <div style={{ padding: '16px 18px', borderRadius: 16, background: t.surface, border: `0.5px solid ${t.line}`, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t.ink2 }}>
          <span>Total</span><span style={{ fontFamily: t.fontMono }}>${total.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: remaining > 0.01 ? t.accentDeep : t.ink3, marginTop: 6, fontWeight: 600 }}>
          <span>Remaining</span><span style={{ fontFamily: t.fontMono }}>${Math.max(0, remaining).toFixed(2)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {splits.map((s, i) => (
          <div key={i} style={{
            padding: 12, borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <select value={s.method} onChange={e => setSplits(splits.map((x, j) => j === i ? { ...x, method: e.target.value } : x))}
              style={{
                padding: '8px 10px', borderRadius: 10, border: `1px solid ${t.line2}`,
                background: t.surface2, color: t.ink, fontFamily: t.fontUI, fontSize: 13, fontWeight: 600,
              }}>
              <option>Card</option><option>Cash</option><option>QR</option>
            </select>
            <input type="number" value={s.amount.toFixed(2)}
              onChange={e => setSplits(splits.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10,
                border: `1px solid ${t.line2}`, background: 'transparent', color: t.ink,
                fontFamily: t.fontMono, fontSize: 15, textAlign: 'right',
              }}/>
            <button onClick={() => setSplits(splits.filter((_, j) => j !== i))} style={{
              width: 36, height: 36, borderRadius: 10, border: 'none',
              background: 'transparent', color: t.ink3, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon.close width="16" height="16"/></button>
          </div>
        ))}
      </div>
      <button onClick={() => setSplits([...splits, { method: 'Cash', amount: Math.max(0, remaining) }])}
        style={{
          marginTop: 10, padding: 12, borderRadius: 12,
          border: `1px dashed ${t.line2}`, background: 'transparent', color: t.ink2,
          fontFamily: t.fontUI, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>+ Add split</button>

      <div style={{ flex: 1 }}/>
      <button onClick={onConfirm} disabled={Math.abs(remaining) > 0.01}
        style={{
          height: 56, borderRadius: 16, border: 'none',
          background: Math.abs(remaining) <= 0.01 ? t.ink : t.surface2,
          color: Math.abs(remaining) <= 0.01 ? t.bg : t.ink3,
          cursor: Math.abs(remaining) <= 0.01 ? 'pointer' : 'not-allowed',
          fontFamily: t.fontUI, fontSize: 16, fontWeight: 600,
        }}>
        {Math.abs(remaining) <= 0.01 ? 'Confirm split' : 'Amounts must equal total'}
      </button>
    </div>
  );
};

Object.assign(window, { PaymentScreen, QRCode });
