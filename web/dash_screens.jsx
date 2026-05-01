// Products table + Registers pairing screen

const DashProducts = ({ t }) => {
  const products = [
    { name: 'Oat Flat White', cat: 'Drinks', price: '$4.80', stock: '∞', status: 'Active', variants: '3 sizes', sw: ['#C9AA85', '#F3E6D3'] },
    { name: 'Heavyweight Tee', cat: 'Apparel', price: '$32.00', stock: 47, status: 'Active', variants: '12 options', sw: ['#2B2B2E', '#E8E4DB'] },
    { name: 'Sourdough Loaf', cat: 'Bakery', price: '$8.50', stock: 12, status: 'Active', variants: '—', low: false, sw: ['#C89B5C', '#EBD4A6'] },
    { name: 'Matcha Latte', cat: 'Drinks', price: '$5.50', stock: '∞', status: 'Active', variants: '3 sizes · 4 milks', sw: ['#8FA678', '#C5D4B0'] },
    { name: 'Almond Croissant', cat: 'Bakery', price: '$4.50', stock: 4, status: 'Active', variants: '—', low: true, sw: ['#D4A865', '#F2DCB5'] },
    { name: 'Wool Tote', cat: 'Gifts', price: '$24.00', stock: 22, status: 'Active', variants: '2 colors', sw: ['#A89A82', '#DCD1B7'] },
    { name: 'Espresso Blend · 12oz', cat: 'Retail', price: '$18.00', stock: 3, status: 'Active', variants: '2 grinds', low: true, sw: ['#3A2A1C', '#8B6B44'] },
    { name: 'Ceramic Mug', cat: 'Gifts', price: '$16.00', stock: 0, status: 'Out', variants: '3 colors', low: true, sw: ['#E8E4DB', '#A89A82'] },
    { name: 'Cold Brew', cat: 'Drinks', price: '$4.50', stock: '∞', status: 'Active', variants: '2 sizes', sw: ['#3A2A1C', '#7B5E42'] },
    { name: 'Pain au Chocolat', cat: 'Bakery', price: '$4.25', stock: 8, status: 'Active', variants: '—', sw: ['#8B5C2C', '#D4A865'] },
  ];

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, padding: 4, background: t.surface, borderRadius: 10, border: `0.5px solid ${t.line}` }}>
          {['All · 247', 'Drinks · 48', 'Bakery · 32', 'Apparel · 24', 'Gifts · 18', 'Low · 6'].map((tab, i) => (
            <button key={tab} style={{
              padding: '6px 12px', borderRadius: 7, border: 'none',
              background: i === 0 ? t.ink : 'transparent',
              color: i === 0 ? t.bg : t.ink2,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
            }}>{tab}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ padding: '8px 12px', borderRadius: 8, border: `0.5px solid ${t.line2}`, background: t.surface, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Import CSV</button>
          <button style={{ padding: '8px 12px', borderRadius: 8, border: `0.5px solid ${t.line2}`, background: t.surface, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Bulk edit</button>
        </div>
      </div>

      <div style={{ background: t.surface, borderRadius: 12, border: `0.5px solid ${t.line}`, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '30px 2.4fr 1fr 1fr 1fr 0.8fr 0.8fr 36px',
          padding: '10px 16px', background: t.surface2, borderBottom: `0.5px solid ${t.line}`,
          fontSize: 10, fontWeight: 700, color: t.ink3, letterSpacing: 0.8, textTransform: 'uppercase',
          alignItems: 'center', gap: 12,
        }}>
          <div><input type="checkbox" style={{ accentColor: t.accentDeep }}/></div>
          <div>Product</div>
          <div>Category</div>
          <div>Variants</div>
          <div style={{ textAlign: 'right' }}>Price</div>
          <div style={{ textAlign: 'right' }}>Stock</div>
          <div>Status</div>
          <div/>
        </div>
        {products.map((p, i) => (
          <div key={p.name} style={{
            display: 'grid', gridTemplateColumns: '30px 2.4fr 1fr 1fr 1fr 0.8fr 0.8fr 36px',
            padding: '12px 16px', borderBottom: i < products.length - 1 ? `0.5px solid ${t.line}` : 'none',
            alignItems: 'center', gap: 12, fontSize: 12.5,
          }}>
            <div><input type="checkbox" style={{ accentColor: t.accentDeep }}/></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <WThumb name={p.name} swatch={p.sw} size={32}/>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.ink3, marginTop: 1 }}>SKU-{String(1000 + i).padStart(4, '0')}</div>
              </div>
            </div>
            <div style={{ color: t.ink2 }}>{p.cat}</div>
            <div style={{ color: t.ink2, fontSize: 11 }}>{p.variants}</div>
            <div style={{ fontFamily: t.fontMono, fontWeight: 600, textAlign: 'right' }}>{p.price}</div>
            <div style={{ fontFamily: t.fontMono, textAlign: 'right', color: p.low ? '#9e2e26' : t.ink }}>
              {p.stock}{p.low && typeof p.stock === 'number' && p.stock > 0 && ' ⚠'}
            </div>
            <div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                background: p.status === 'Out' ? 'rgba(216,76,63,0.1)' : 'rgba(75,169,113,0.12)',
                color: p.status === 'Out' ? '#9e2e26' : '#2f7a4e',
              }}>{p.status}</span>
            </div>
            <div style={{ color: t.ink3, fontSize: 16, textAlign: 'center', cursor: 'pointer' }}>⋯</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: t.ink3 }}>
        <div>Showing 10 of 247 products</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['‹', '1', '2', '3', '…', '25', '›'].map((p, i) => (
            <button key={i} style={{
              minWidth: 26, height: 26, padding: '0 8px', borderRadius: 6, border: `0.5px solid ${t.line}`,
              background: p === '1' ? t.ink : t.surface, color: p === '1' ? t.bg : t.ink2,
              cursor: 'pointer', fontFamily: t.fontMono, fontSize: 11,
            }}>{p}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Registers — the sync story screen
const DashRegisters = ({ t }) => (
  <div style={{ padding: 28, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Connected devices</div>
        <button style={{
          padding: '8px 14px', borderRadius: 10, border: 'none', background: t.ink, color: t.bg,
          cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
        }}><WIcon.plus width="14" height="14"/> Pair new device</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { name: 'Register 01', dev: 'Pixel 7 · Android 14', user: 'Ana Reyes', ip: '192.168.1.42', sync: '43ms ago', open: true, shift: '$384 drawer · 47 orders today', battery: 72 },
          { name: 'Register 02', dev: 'iPad Pro · iPadOS 17', user: 'Marco Silva', ip: '192.168.1.51', sync: '1.2s ago', open: true, shift: '$220 drawer · 21 orders today', battery: 94 },
          { name: 'Register 03', dev: 'iPhone 15 · iOS 17', user: 'Kim Tanaka', ip: '—', sync: '2h ago', open: false, shift: 'Signed out · last shift $612', battery: null },
        ].map(d => (
          <div key={d.name} style={{
            padding: 18, borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: d.open ? 'rgba(75,169,113,0.12)' : t.surface2,
                color: d.open ? '#2f7a4e' : t.ink3,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <WIcon.device width="22" height="22"/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{d.name}</div>
                  {d.open ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#2f7a4e', padding: '2px 8px', borderRadius: 999, background: 'rgba(75,169,113,0.12)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: '#4BA971' }}/>
                      LIVE
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, fontWeight: 700, color: t.ink3, padding: '2px 8px', borderRadius: 999, background: t.bg }}>OFFLINE</div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: t.ink3, marginTop: 3 }}>{d.dev} · signed in as {d.user}</div>
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: 10, background: t.surface2, borderRadius: 8 }}>
                  <KV t={t} k="Shift" v={d.shift} wide/>
                  <KV t={t} k="Last sync" v={d.sync}/>
                  <KV t={t} k="Local IP" v={d.ip}/>
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                  <button style={{ padding: '6px 10px', borderRadius: 7, border: `0.5px solid ${t.line2}`, background: t.surface, fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>View orders</button>
                  <button style={{ padding: '6px 10px', borderRadius: 7, border: `0.5px solid ${t.line2}`, background: t.surface, fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>Rename</button>
                  <button style={{ padding: '6px 10px', borderRadius: 7, border: `0.5px solid ${t.line2}`, background: t.surface, color: '#9e2e26', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>Sign out remotely</button>
                </div>
              </div>
              {d.battery !== null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: t.fontMono, fontSize: 11, fontWeight: 700 }}>{d.battery}%</div>
                  <div style={{ width: 32, height: 6, borderRadius: 3, background: t.bg, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${d.battery}%`, height: '100%', background: d.battery > 30 ? t.accent : '#D84C3F' }}/>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>

    <div>
      <div style={{ padding: 24, borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}`, textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Pair a new device</div>
        <div style={{ fontSize: 11, color: t.ink3, marginBottom: 18 }}>Scan this QR from the Counter app's sign-in screen</div>
        <QrMock t={t}/>
        <div style={{ marginTop: 16, padding: '10px 12px', background: t.surface2, borderRadius: 8, fontFamily: t.fontMono, fontSize: 12, fontWeight: 600, letterSpacing: 3, color: t.ink }}>
          CNTR-48J2-9KX1
        </div>
        <div style={{ fontSize: 10, color: t.ink3, marginTop: 6 }}>Or type this code manually · expires in 4:32</div>
      </div>

      <div style={{ padding: 20, borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}`, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Sync health · last 24h</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { k: 'Successful syncs', v: '12,847', ok: true },
            { k: 'Conflicts resolved', v: '3', ok: true },
            { k: 'Median latency', v: '41ms', ok: true },
            { k: 'Failed syncs', v: '0', ok: true },
          ].map(m => (
            <div key={m.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: t.ink2 }}>{m.k}</div>
              <div style={{ fontFamily: t.fontMono, fontSize: 13, fontWeight: 700, color: m.ok ? '#2f7a4e' : '#9e2e26' }}>{m.v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: 10, borderRadius: 8, background: 'rgba(75,169,113,0.08)', fontSize: 11, color: '#2f7a4e', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          <WIcon.check width="14" height="14"/>
          All systems operational
        </div>
      </div>
    </div>
  </div>
);

const KV = ({ t, k, v, wide }) => (
  <div style={wide ? { gridColumn: '1 / -1' } : {}}>
    <div style={{ fontSize: 9, color: t.ink3, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{k}</div>
    <div style={{ fontSize: 11, color: t.ink2, marginTop: 2, fontFamily: /last|IP|ms/.test(k) ? t.fontMono : 'inherit' }}>{v}</div>
  </div>
);

const QrMock = ({ t }) => {
  // fake QR pattern
  const cells = [];
  const rand = (x, y) => ((x * 73 + y * 31 + 7) % 5) < 2;
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const isFinder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      const finderRing = isFinder && ((x === 0 || x === 6 || y === 0 || y === 6 || (x > 13 && x === 14) || (y > 13 && y === 14)) ||
        (x >= 2 && x <= 4 && y >= 2 && y <= 4) || (x >= 16 && x <= 18 && y >= 2 && y <= 4) || (x >= 2 && x <= 4 && y >= 16 && y <= 18));
      // simpler: use finder + noise
      if (isFinder) {
        const cx = x < 7 ? 3 : 17;
        const cy = y < 7 ? 3 : 17;
        const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
        const on = dx === 3 || dy === 3 || (dx <= 1 && dy <= 1);
        if (on) cells.push([x, y]);
      } else if (rand(x, y)) cells.push([x, y]);
    }
  }
  return (
    <svg viewBox="0 0 21 21" width="180" height="180" style={{ background: '#fff', padding: 8, borderRadius: 10, border: `0.5px solid ${t.line}` }}>
      {cells.map(([x, y], i) => <rect key={i} x={x} y={y} width="1" height="1" fill={t.ink}/>)}
      <rect x="9" y="9" width="3" height="3" fill={t.accent}/>
    </svg>
  );
};

Object.assign(window, { DashProducts, DashRegisters });
