// Dashboard home screen — big numbers, live register activity, recent orders, chart

const DashHome = ({ t }) => (
  <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
    <KpiRow t={t}/>
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
      <SalesChartCard t={t}/>
      <LiveRegistersCard t={t}/>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
      <RecentOrdersCard t={t}/>
      <TopItemsCard t={t}/>
    </div>
  </div>
);

const KpiRow = ({ t }) => {
  const kpis = [
    { label: 'Today · Gross sales', v: '$1,284.40', delta: '+12% vs yest', up: true, spark: [10,12,9,14,16,18,22,26,24,28] },
    { label: 'Orders', v: '47', delta: '+3 last hr', up: true, spark: [2,3,2,4,3,5,4,6,5,7] },
    { label: 'Avg ticket', v: '$27.30', delta: '−$0.40', up: false, spark: [27,28,26,27,28,27,26,27,28,27] },
    { label: 'Net margin', v: '63.2%', delta: '+1.1pt', up: true, spark: [60,61,62,61,62,63,62,63,64,63] },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {kpis.map(k => (
        <div key={k.label} style={{
          padding: 18, borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}`,
        }}>
          <div style={{ fontSize: 11, color: t.ink3, fontWeight: 600, letterSpacing: 0.3 }}>{k.label}</div>
          <div style={{ fontFamily: t.fontMono, fontSize: 28, fontWeight: 700, marginTop: 6, letterSpacing: -0.5 }}>{k.v}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              background: k.up ? 'rgba(75,169,113,0.12)' : 'rgba(216,76,63,0.1)',
              color: k.up ? '#2f7a4e' : '#9e2e26',
            }}>{k.delta}</div>
            <MiniSpark t={t} data={k.spark} up={k.up}/>
          </div>
        </div>
      ))}
    </div>
  );
};

const MiniSpark = ({ t, data, up }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const w = 60, h = 22;
  const path = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d - min) / (max - min || 1)) * h}`).join(' L');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={`M${path}`} fill="none" stroke={up ? t.accentDeep : t.ink3} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
};

const SalesChartCard = ({ t }) => {
  const [range, setRange] = React.useState('Today');
  return (
    <div style={{ padding: 20, borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Sales over time</div>
          <div style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>Hourly · gross · both registers</div>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 3, background: t.bg, borderRadius: 8 }}>
          {['Today', '7d', '30d', '90d'].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '4px 10px', borderRadius: 6, border: 'none',
              background: range === r ? t.surface : 'transparent',
              color: range === r ? t.ink : t.ink3,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
              boxShadow: range === r ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}>{r}</button>
          ))}
        </div>
      </div>
      <BigChart t={t}/>
    </div>
  );
};

const BigChart = ({ t }) => {
  const hours = ['8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p'];
  const data = [12, 28, 45, 62, 78, 95, 82, 70, 68, 85, 92, 74];
  const max = 110, w = 760, h = 200;
  const path = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - (d / max) * h}`).join(' L');
  const area = `M0,${h} L${path} L${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h + 30}`} width="100%" height="230">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.accent} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={t.accent} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(r => (
        <line key={r} x1="0" x2={w} y1={h * r} y2={h * r} stroke={t.line} strokeDasharray="2,4"/>
      ))}
      <path d={area} fill="url(#chartFill)"/>
      <path d={`M${path}`} fill="none" stroke={t.accentDeep} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {data.map((d, i) => (
        <circle key={i} cx={(i / (data.length - 1)) * w} cy={h - (d / max) * h} r="3.5" fill={t.surface} stroke={t.accentDeep} strokeWidth="2"/>
      ))}
      {hours.map((hr, i) => (
        <text key={hr} x={(i / (hours.length - 1)) * w} y={h + 18} textAnchor="middle" fontFamily='"JetBrains Mono", monospace' fontSize="9" fill={t.ink3}>{hr}</text>
      ))}
      {/* highlight current hour */}
      <g transform={`translate(${(10 / (data.length - 1)) * w}, ${h - (data[10] / max) * h})`}>
        <circle r="6" fill={t.accent}/>
        <circle r="10" fill="none" stroke={t.accent} strokeOpacity="0.35"/>
      </g>
    </svg>
  );
};

const LiveRegistersCard = ({ t }) => {
  const regs = [
    { name: 'Register 01', device: 'Pixel 7 · Ana', open: true, shift: '$384 in drawer', started: '7:12a', sales: '$842' },
    { name: 'Register 02', device: 'iPad · Marco', open: true, shift: '$220 in drawer', started: '8:30a', sales: '$442' },
    { name: 'Register 03', device: 'iPhone · Kim', open: false, shift: 'Closed', started: 'yesterday', sales: '—' },
  ];
  return (
    <div style={{ padding: 20, borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Live registers</div>
          <div style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>Open shifts and today's take</div>
        </div>
        <button style={{ fontSize: 11, color: t.ink2, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Manage →</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {regs.map(r => (
          <div key={r.name} style={{
            padding: '12px 14px', borderRadius: 10, background: t.surface2, border: `0.5px solid ${t.line}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: r.open ? 'rgba(75,169,113,0.12)' : t.bg,
              color: r.open ? '#2f7a4e' : t.ink3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <WIcon.device width="18" height="18"/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                {r.open && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 9, fontWeight: 600, color: '#2f7a4e',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: '#4BA971', animation: 'pulse 2s infinite' }}/>
                    LIVE
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}>{r.device} · open since {r.started}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 13, fontWeight: 700 }}>{r.sales}</div>
              <div style={{ fontSize: 10, color: t.ink3, marginTop: 1 }}>{r.shift}</div>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
    </div>
  );
};

const RecentOrdersCard = ({ t }) => {
  const orders = [
    { id: '#1284', time: '2 min ago', items: '2 items · Oat Flat White, Croissant', total: '$12.30', reg: '01', status: 'Paid' },
    { id: '#1283', time: '7 min ago', items: '1 item · Heavyweight Tee (M, Charcoal)', total: '$32.00', reg: '02', status: 'Paid' },
    { id: '#1282', time: '12 min ago', items: '4 items · Coffee flight', total: '$18.50', reg: '01', status: 'Paid' },
    { id: '#1281', time: '18 min ago', items: '3 items · Pastry box', total: '$24.00', reg: '02', status: 'Refund', bad: true },
    { id: '#1280', time: '23 min ago', items: '1 item · Sourdough Loaf', total: '$8.50', reg: '01', status: 'Paid' },
  ];
  return (
    <div style={{ padding: 20, borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Recent orders</div>
        <button style={{ fontSize: 11, color: t.ink2, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
      </div>
      {orders.map(o => (
        <div key={o.id} style={{
          padding: '10px 0', borderBottom: `0.5px solid ${t.line}`,
          display: 'grid', gridTemplateColumns: '60px 1fr 50px 80px 70px', gap: 12, alignItems: 'center',
        }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, color: t.ink2 }}>{o.id}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.items}</div>
            <div style={{ fontSize: 10, color: t.ink3, marginTop: 1 }}>{o.time}</div>
          </div>
          <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.ink3, textAlign: 'center' }}>R{o.reg}</div>
          <div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, textAlign: 'right' }}>{o.total}</div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              background: o.bad ? 'rgba(216,76,63,0.1)' : 'rgba(75,169,113,0.12)',
              color: o.bad ? '#9e2e26' : '#2f7a4e',
            }}>{o.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const TopItemsCard = ({ t }) => {
  const items = [
    { n: 'Oat Flat White', c: 42, r: '$201.60', pct: 100, sw: ['#C9AA85', '#F3E6D3'] },
    { n: 'Sourdough Loaf', c: 28, r: '$238.00', pct: 82, sw: ['#C89B5C', '#EBD4A6'] },
    { n: 'Heavyweight Tee', c: 14, r: '$448.00', pct: 56, sw: ['#2B2B2E', '#E8E4DB'] },
    { n: 'Matcha Latte', c: 22, r: '$121.00', pct: 48, sw: ['#8FA678', '#C5D4B0'] },
    { n: 'Almond Croissant', c: 31, r: '$139.50', pct: 42, sw: ['#D4A865', '#F2DCB5'] },
  ];
  return (
    <div style={{ padding: 20, borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Top items today</div>
        <button style={{ fontSize: 11, color: t.ink2, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Reports →</button>
      </div>
      {items.map(it => (
        <div key={it.n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
          <WThumb name={it.n} swatch={it.sw} size={32}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{it.n}</div>
              <div style={{ fontFamily: t.fontMono, fontSize: 11, fontWeight: 600 }}>{it.r}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: t.bg, overflow: 'hidden' }}>
                <div style={{ width: `${it.pct}%`, height: '100%', background: t.accent }}/>
              </div>
              <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.ink3, minWidth: 28, textAlign: 'right' }}>{it.c}×</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

Object.assign(window, { DashHome });
