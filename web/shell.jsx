// Dashboard shell + sidebar + top bar

const DashShell = ({ t, active, onNav, children }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '240px 1fr',
    height: '100%', background: t.bg, color: t.ink, fontFamily: t.fontUI,
  }}>
    <DashSidebar t={t} active={active} onNav={onNav}/>
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <DashTopBar t={t} active={active}/>
      <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
    </div>
  </div>
);

const DashSidebar = ({ t, active, onNav }) => {
  const sections = [
    { group: 'Workspace', items: [
      { id: 'dashboard', label: 'Dashboard', icon: WIcon.home },
      { id: 'orders',    label: 'Orders', icon: WIcon.receipt, badge: '3' },
      { id: 'products',  label: 'Products', icon: WIcon.box },
      { id: 'customers', label: 'Customers', icon: WIcon.people },
      { id: 'reports',   label: 'Reports', icon: WIcon.chart },
    ]},
    { group: 'Connect', items: [
      { id: 'registers', label: 'Registers', icon: WIcon.device, badge: '3 online', badgeOk: true },
      { id: 'locations', label: 'Locations', icon: WIcon.pin },
      { id: 'team',      label: 'Team', icon: WIcon.people },
    ]},
  ];
  return (
    <aside style={{
      background: t.surface, borderRight: `0.5px solid ${t.line}`,
      display: 'flex', flexDirection: 'column', padding: '20px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 20px' }}>
        <WIcon.logo width="22" height="22"/>
        <div>
          <div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>COUNTER</div>
          <div style={{ fontSize: 10, color: t.ink3 }}>Field Studio · Pro</div>
        </div>
      </div>

      <div style={{
        padding: '8px 10px', borderRadius: 10, background: t.surface2, border: `0.5px solid ${t.line}`,
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18,
      }}>
        <WIcon.search width="14" height="14" style={{ color: t.ink3 }}/>
        <span style={{ fontSize: 12, color: t.ink3, flex: 1 }}>Search…</span>
        <span style={{ fontFamily: t.fontMono, fontSize: 9, color: t.ink3, padding: '1px 5px', borderRadius: 4, background: t.bg }}>⌘K</span>
      </div>

      {sections.map(sec => (
        <div key={sec.group} style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: t.ink3, letterSpacing: 1.5,
            textTransform: 'uppercase', padding: '0 10px 8px',
          }}>{sec.group}</div>
          {sec.items.map(it => {
            const isActive = active === it.id;
            return (
              <button key={it.id} onClick={() => onNav(it.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8, border: 'none',
                background: isActive ? t.ink : 'transparent',
                color: isActive ? t.bg : t.ink2,
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                marginBottom: 2, textAlign: 'left',
              }}>
                <it.icon width="16" height="16" style={{ flexShrink: 0 }}/>
                <span style={{ flex: 1 }}>{it.label}</span>
                {it.badge && (
                  <span style={{
                    fontFamily: t.fontMono, fontSize: 9, fontWeight: 600,
                    padding: '2px 6px', borderRadius: 4,
                    background: isActive ? 'rgba(255,255,255,0.15)' : (it.badgeOk ? 'rgba(75,169,113,0.15)' : t.accentSoft),
                    color: isActive ? t.bg : (it.badgeOk ? '#2f7a4e' : t.accentDeep),
                  }}>{it.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      <div style={{ flex: 1 }}/>
      <div style={{
        padding: 12, borderRadius: 12, background: t.accentSoft, color: t.accentDeep,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>Sync healthy</div>
        <div style={{ fontFamily: t.fontMono, fontSize: 10, marginTop: 4, opacity: 0.8 }}>
          3 devices · last 43ms ago
        </div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' }}>
        <div style={{
          width: 30, height: 30, borderRadius: 15, background: '#C9AA85',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 11, fontFamily: t.fontMono,
        }}>AR</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>Ana Reyes</div>
          <div style={{ fontSize: 10, color: t.ink3 }}>Owner · Admin</div>
        </div>
      </div>
    </aside>
  );
};

const DashTopBar = ({ t, active }) => {
  const titles = {
    dashboard: { t: 'Dashboard', s: 'Thursday, March 14 · Field Studio' },
    orders:    { t: 'Orders', s: '1,284 orders · last 30 days' },
    products:  { t: 'Products', s: '247 items · 6 low on stock' },
    customers: { t: 'Customers', s: '1,082 customers · 43 new this month' },
    reports:   { t: 'Reports', s: 'Sales, inventory, team performance' },
    registers: { t: 'Registers', s: '3 devices signed in · all synced' },
    locations: { t: 'Locations', s: '1 location on your plan' },
    team:      { t: 'Team', s: '4 members · 2 active now' },
  };
  const it = titles[active] || titles.dashboard;
  return (
    <div style={{
      height: 60, padding: '0 28px', borderBottom: `0.5px solid ${t.line}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: t.bg,
    }}>
      <div>
        <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 500, letterSpacing: -0.3 }}>{it.t}</div>
        <div style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}>{it.s}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          padding: '6px 10px', borderRadius: 8, background: t.surface,
          border: `0.5px solid ${t.line}`, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: '#4BA971' }}/>
          <span style={{ fontFamily: t.fontMono, fontSize: 10.5, color: t.ink2 }}>LIVE · 3 devices</span>
        </div>
        <button style={{
          padding: '8px 14px', borderRadius: 10, border: `1px solid ${t.line2}`,
          background: t.surface, color: t.ink, cursor: 'pointer', fontSize: 12, fontWeight: 500,
        }}>Export</button>
        <button style={{
          padding: '8px 14px', borderRadius: 10, border: 'none',
          background: t.ink, color: t.bg, cursor: 'pointer', fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}><WIcon.plus width="14" height="14"/> New</button>
      </div>
    </div>
  );
};

Object.assign(window, { DashShell });
