// Secondary screens: Login/PIN, Shift Open/Close, Order History, Customers, Settings, Parked

const LoginScreen = ({ t, onUnlock }) => {
  const [pin, setPin] = React.useState('');
  const [err, setErr] = React.useState(false);
  const append = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === '1234' || next.length === 4) onUnlock();
        else { setErr(true); setPin(''); }
      }, 250);
    }
  };
  const back = () => setPin(pin.slice(0, -1));
  return (
    <>
      <CounterStatusBar t={t}/>
      <div style={{ padding: '60px 20px 0', textAlign: 'center' }}>
        <div style={{
          margin: '0 auto 24px', width: 56, height: 56, borderRadius: 16,
          background: t.ink, color: t.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon.logo width="28" height="28"/></div>
        <div style={{ fontSize: 13, color: t.ink3, fontFamily: t.fontMono, letterSpacing: 2, textTransform: 'uppercase' }}>Counter</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, marginTop: 14, letterSpacing: -0.3 }}>Welcome back, Ana</div>
        <div style={{ fontSize: 13, color: t.ink3, marginTop: 4 }}>Enter your 4-digit PIN</div>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', margin: '36px 0 30px' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: 7,
              background: i < pin.length ? t.ink : 'transparent',
              border: `1.5px solid ${err ? '#D84C3F' : t.line2}`,
              transition: 'background 0.15s',
            }}/>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 30px 20px' }}>
        <NumberPad t={t} onTap={append} onBack={back} allowDot={false}/>
        <button style={{
          marginTop: 14, width: '100%', height: 44, border: 'none',
          background: 'transparent', color: t.ink3, cursor: 'pointer',
          fontFamily: t.fontUI, fontSize: 13,
        }}>Use passcode instead</button>
      </div>
    </>
  );
};

const ShiftOpenScreen = ({ t, onStart }) => {
  const [cash, setCash] = React.useState('200.00');
  return (
    <>
      <CounterStatusBar t={t}/>
      <NavBar t={t} title="Open shift" subtitle="Register 01 · Thu 21 Apr" large={true}/>
      <div style={{ padding: '0 16px 20px' }}>
        <div style={{
          padding: 16, borderRadius: 16, background: t.surface, border: `0.5px solid ${t.line}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.ink2, textTransform: 'uppercase', letterSpacing: 0.8 }}>Opening cash</div>
          <div style={{ fontSize: 12, color: t.ink3, marginTop: 4 }}>Count the drawer before starting.</div>
          <div style={{
            marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 4,
          }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 28, color: t.ink3 }}>$</span>
            <input value={cash} onChange={e => setCash(e.target.value)} style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: t.fontMono, fontSize: 34, fontWeight: 700, color: t.ink,
            }}/>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 16, borderRadius: 16, background: t.surface, border: `0.5px solid ${t.line}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.ink2, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Devices</div>
          {[
            { name: 'Star TSP143 Thermal', ok: true, sub: 'Bluetooth · 88%' },
            { name: 'Card reader', ok: true, sub: 'Paired · ready' },
            { name: 'Cash drawer', ok: true, sub: 'Connected' },
          ].map(d => (
            <div key={d.name} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
              borderTop: `0.5px solid ${t.line}`,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: d.ok ? '#4BA971' : '#D84C3F' }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: t.ink3, fontFamily: t.fontMono, marginTop: 1 }}>{d.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '12px 16px 28px', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <button onClick={onStart} style={{
          width: '100%', height: 54, borderRadius: 16, border: 'none',
          background: t.ink, color: t.bg, cursor: 'pointer',
          fontFamily: t.fontUI, fontSize: 16, fontWeight: 600,
        }}>Start selling</button>
      </div>
    </>
  );
};

const ShiftCloseScreen = ({ t, onBack }) => {
  const rows = [
    { label: 'Sales', v: '$1,284.40', sub: '47 orders' },
    { label: 'Refunds', v: '−$34.00', sub: '1 refund' },
    { label: 'Cash', v: '$342.10' },
    { label: 'Card', v: '$712.30' },
    { label: 'QR', v: '$196.00' },
  ];
  return (
    <>
      <CounterStatusBar t={t}/>
      <NavBar t={t} title="Close shift" subtitle="Ana M. · 9:02 AM – 2:41 PM" large={true} onBack={onBack}/>
      <div style={{ padding: '0 16px 20px', overflow: 'auto', height: 'calc(100% - 180px)' }}>
        <div style={{
          padding: 18, borderRadius: 18, background: t.ink, color: t.bg,
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <span style={{ fontSize: 13, opacity: 0.6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Net sales</span>
          <span style={{ fontFamily: t.fontMono, fontSize: 28, fontWeight: 700 }}>$1,250.40</span>
        </div>

        <div style={{ marginTop: 12, padding: '4px 14px', borderRadius: 16, background: t.surface, border: `0.5px solid ${t.line}` }}>
          {rows.map((r, i) => (
            <div key={r.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: '12px 0', borderTop: i > 0 ? `0.5px solid ${t.line}` : 'none',
            }}>
              <div>
                <div style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>{r.label}</div>
                {r.sub && <div style={{ fontSize: 11, color: t.ink3, marginTop: 2, fontFamily: t.fontMono }}>{r.sub}</div>}
              </div>
              <div style={{ fontFamily: t.fontMono, fontSize: 15, fontWeight: 600, color: t.ink }}>{r.v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, padding: 16, borderRadius: 16, background: t.surface, border: `0.5px solid ${t.line}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.ink2, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Expected drawer</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t.ink2, padding: '4px 0' }}>
            <span>Opening cash</span><span style={{ fontFamily: t.fontMono }}>$200.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t.ink2, padding: '4px 0' }}>
            <span>Cash sales</span><span style={{ fontFamily: t.fontMono }}>+$342.10</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: t.ink, fontWeight: 600, padding: '8px 0 0', borderTop: `0.5px solid ${t.line}`, marginTop: 6 }}>
            <span>Expected</span><span style={{ fontFamily: t.fontMono }}>$542.10</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 16px 28px', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <button style={{
          width: '100%', height: 54, borderRadius: 16, border: 'none',
          background: t.ink, color: t.bg, cursor: 'pointer',
          fontFamily: t.fontUI, fontSize: 16, fontWeight: 600,
        }}>Close shift & print Z-report</button>
      </div>
    </>
  );
};

const OrdersScreen = ({ t, tab, setTab, onCart, cartCount }) => {
  const [scroll, setScroll] = React.useState(0);
  return (
    <>
      <CounterStatusBar t={t}/>
      <div onScroll={e => setScroll(e.target.scrollTop)} style={{ height: 'calc(100% - 40px)', overflow: 'auto', paddingBottom: 100 }}>
        <NavBar t={t} title="Orders" subtitle="Today · 47 orders · $1,284.40" scroll={scroll}/>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ORDER_HISTORY.map(o => (
            <button key={o.id} style={{
              padding: 14, borderRadius: 14, border: `0.5px solid ${t.line}`,
              background: t.surface, display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer', textAlign: 'left', fontFamily: t.fontUI,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: o.status === 'refunded' ? '#FDECEA' : t.surface2,
                color: o.status === 'refunded' ? '#D84C3F' : t.ink2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {o.method === 'Cash' && <Icon.cash width="20" height="20"/>}
                {o.method === 'Card' && <Icon.card width="20" height="20"/>}
                {o.method === 'QR' && <Icon.qr width="20" height="20"/>}
                {o.method === 'Split' && <Icon.split width="20" height="20"/>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>#{o.id}</span>
                  {o.status === 'refunded' && (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#FDECEA', color: '#D84C3F', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>Refund</span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: t.ink3, marginTop: 2 }}>
                  {o.time} · {o.items} items{o.customer ? ` · ${o.customer}` : ''}
                </div>
              </div>
              <div style={{ fontFamily: t.fontMono, fontSize: 15, fontWeight: 600, color: o.status === 'refunded' ? t.ink3 : t.ink,
                textDecoration: o.status === 'refunded' ? 'line-through' : 'none' }}>
                ${o.total.toFixed(2)}
              </div>
            </button>
          ))}
        </div>
      </div>
      <TabBar t={t} active={tab} onChange={setTab} cartCount={cartCount} onCart={onCart}/>
    </>
  );
};

const CustomersScreen = ({ t, tab, setTab, onCart, cartCount, onPick }) => {
  const [q, setQ] = React.useState('');
  const filtered = CUSTOMERS.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <CounterStatusBar t={t}/>
      <div style={{ height: 'calc(100% - 40px)', overflow: 'auto', paddingBottom: 100 }}>
        <NavBar t={t} title={onPick ? 'Add customer' : 'People'} onBack={onPick}
          trailing={!onPick && <button style={{
            height: 36, padding: '0 12px', borderRadius: 12, border: 'none',
            background: t.accentSoft, color: t.accentDeep, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: t.fontUI,
          }}>+ New</button>}/>
        <div style={{ padding: '4px 20px 14px' }}>
          <div style={{
            height: 44, borderRadius: 14, background: t.surface2,
            display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
            border: `0.5px solid ${t.line}`,
          }}>
            <Icon.search width="18" height="18" style={{ color: t.ink3 }}/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, phone"
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: t.fontUI, fontSize: 15, color: t.ink }}/>
          </div>
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {onPick && (
            <button onClick={() => onPick(null)} style={{
              padding: 14, borderRadius: 14, border: `1px dashed ${t.line2}`, background: 'transparent',
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', fontFamily: t.fontUI,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, background: t.surface2, color: t.ink3,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon.user width="18" height="18"/>
              </div>
              <span style={{ fontSize: 14, color: t.ink, fontWeight: 600 }}>Walk-in (no customer)</span>
            </button>
          )}
          {filtered.map(c => (
            <button key={c.id} onClick={() => onPick?.(c)} style={{
              padding: 14, borderRadius: 14, border: `0.5px solid ${t.line}`,
              background: t.surface, display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer', textAlign: 'left', fontFamily: t.fontUI,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, background: t.accentSoft, color: t.accentDeep,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                {c.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: t.ink3, marginTop: 2, fontFamily: t.fontMono }}>{c.email}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: t.fontMono, fontSize: 13, fontWeight: 600, color: t.accentDeep }}>{c.loyalty} pts</div>
                <div style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>{c.visits} visits</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      {!onPick && <TabBar t={t} active={tab} onChange={setTab} cartCount={cartCount} onCart={onCart}/>}
    </>
  );
};

const SettingsScreen = ({ t, tab, setTab, onCart, cartCount, onCloseShift, onImportExport }) => (
  <>
    <CounterStatusBar t={t}/>
    <div style={{ height: 'calc(100% - 40px)', overflow: 'auto', paddingBottom: 100 }}>
      <NavBar t={t} title="Settings"/>

      <div style={{ padding: '0 16px 10px' }}>
        <div style={{
          padding: 14, borderRadius: 16, background: t.surface, border: `0.5px solid ${t.line}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: t.accentSoft, color: t.accentDeep,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>AM</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>Ana Morales</div>
            <div style={{ fontSize: 11.5, color: t.ink3, marginTop: 2 }}>Register 01 · Shift open 9:02 AM</div>
          </div>
          <button onClick={onCloseShift} style={{
            padding: '8px 12px', borderRadius: 10, border: `1px solid ${t.line2}`,
            background: 'transparent', color: t.ink, cursor: 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: t.fontUI,
          }}>Close shift</button>
        </div>
      </div>

      <SettingsGroup t={t} title="Hardware" items={[
        { icon: Icon.printer, label: 'Thermal printer', value: 'Star TSP143 · 88%', ok: true },
        { icon: Icon.bluetooth, label: 'Card reader', value: 'Paired', ok: true },
        { icon: Icon.scan, label: 'Barcode scanner', value: 'Camera', ok: true },
        { icon: Icon.wifi, label: 'Network', value: 'Shop WiFi 5G', ok: true },
      ]}/>

      <SettingsGroup t={t} title="Store" items={[
        { icon: Icon.receipt, label: 'Receipt footer', value: 'Thank you' },
        { icon: Icon.discount, label: 'Taxes', value: '8% · state' },
        { icon: Icon.table, label: 'Tables & floor plan', value: '14 tables' },
        { icon: Icon.user, label: 'Team & roles', value: '3 people' },
      ]}/>

      <SettingsGroup t={t} title="Data" items={[
        { icon: Icon.swap, label: 'Import & export', value: 'CSV · XLSX', onClick: onImportExport },
        { icon: Icon.upload, label: 'Sync to cloud', value: 'Auto · 2 min ago' },
        { icon: Icon.refresh, label: 'Backup', value: 'Daily' },
      ]}/>

      <SettingsGroup t={t} title="About" items={[
        { icon: Icon.logo, label: 'Counter POS', value: 'v1.4.2' },
      ]}/>

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.ink3, textTransform: 'uppercase', letterSpacing: 1, padding: '0 6px 6px' }}>Developer</div>
        <DeveloperCard t={t} variant="mobile" compact/>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 10, color: t.ink3, fontFamily: t.fontMono }}>
          Counter v1.4.2 · build 1428 · android
        </div>
      </div>
    </div>
    <TabBar t={t} active={tab} onChange={setTab} cartCount={cartCount} onCart={onCart}/>
  </>
);

const SettingsGroup = ({ t, title, items }) => (
  <div style={{ padding: '14px 16px 0' }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: t.ink3, textTransform: 'uppercase', letterSpacing: 1, padding: '0 6px 6px' }}>{title}</div>
    <div style={{ background: t.surface, borderRadius: 16, border: `0.5px solid ${t.line}`, overflow: 'hidden' }}>
      {items.map((it, i) => (
        <button key={it.label} onClick={it.onClick} disabled={!it.onClick} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          borderTop: i > 0 ? `0.5px solid ${t.line}` : 'none',
          border: 'none', background: 'transparent', textAlign: 'left', fontFamily: 'inherit',
          cursor: it.onClick ? 'pointer' : 'default',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: t.surface2, color: t.ink2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><it.icon width="16" height="16"/></div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: t.ink, fontWeight: 500 }}>{it.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {it.ok && <div style={{ width: 6, height: 6, borderRadius: 3, background: '#4BA971' }}/>}
            <span style={{ fontSize: 12, color: t.ink3, fontFamily: t.fontMono }}>{it.value}</span>
            <Icon.chevron width="14" height="14" style={{ color: t.ink3 }}/>
          </div>
        </button>
      ))}
    </div>
  </div>
);

const ParkedSheet = ({ t, onClose, onResume }) => (
  <div style={{
    position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'flex-end', animation: 'fadeIn 0.2s',
  }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{
      width: '100%', background: t.surface, borderRadius: '24px 24px 0 0',
      maxHeight: '75%', display: 'flex', flexDirection: 'column',
      animation: 'slideUp 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: t.line2 }}/>
      </div>
      <div style={{ padding: '12px 20px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.ink }}>Parked orders</div>
        <div style={{ fontSize: 12, color: t.ink3 }}>{PARKED_ORDERS.length} held</div>
      </div>
      <div style={{ overflow: 'auto', padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PARKED_ORDERS.map(p => (
          <button key={p.id} onClick={() => onResume(p)} style={{
            padding: 14, borderRadius: 14, background: t.surface2, border: `0.5px solid ${t.line}`,
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', fontFamily: t.fontUI,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: t.surface, color: t.ink2,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon.table width="18" height="18"/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{p.label}</div>
              <div style={{ fontSize: 11.5, color: t.ink3, marginTop: 2 }}>{p.items} items{p.note ? ` · ${p.note}` : ''}</div>
            </div>
            <div style={{ fontFamily: t.fontMono, fontSize: 14, fontWeight: 600, color: t.ink }}>${p.total.toFixed(2)}</div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

Object.assign(window, { LoginScreen, ShiftOpenScreen, ShiftCloseScreen, OrdersScreen, CustomersScreen, SettingsScreen, ParkedSheet });
