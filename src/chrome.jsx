// Shared chrome: POS status bar, nav header, tab bar

const CounterStatusBar = ({ t, time = '9:41' }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 28px 8px', fontFamily: t.fontUI,
    fontSize: 15, fontWeight: 600, color: t.ink,
  }}>
    <span style={{ fontFamily: t.fontMono }}>{time}</span>
    <span style={{ width: 126, height: 37 }} />
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <svg width="16" height="11" viewBox="0 0 16 11"><rect x="0" y="7" width="2.5" height="4" rx="0.5" fill={t.ink}/><rect x="4" y="5" width="2.5" height="6" rx="0.5" fill={t.ink}/><rect x="8" y="3" width="2.5" height="8" rx="0.5" fill={t.ink}/><rect x="12" y="0" width="2.5" height="11" rx="0.5" fill={t.ink}/></svg>
      <svg width="22" height="11" viewBox="0 0 22 11"><rect x="0.5" y="0.5" width="19" height="10" rx="2.5" fill="none" stroke={t.ink} strokeOpacity="0.4"/><rect x="2" y="2" width="16" height="7" rx="1.5" fill={t.ink}/><path d="M20.5 3.5v4c.6-.2 1-.8 1-2s-.4-1.8-1-2z" fill={t.ink} fillOpacity="0.5"/></svg>
    </span>
  </div>
);

// Large title nav bar — with optional leading/trailing buttons
const NavBar = ({ t, title, subtitle, leading, trailing, large = true, onBack, scroll = 0 }) => {
  const shrink = Math.min(1, scroll / 60);
  return (
    <div style={{
      padding: large ? '4px 20px 16px' : '8px 20px 12px',
      borderBottom: scroll > 4 ? `0.5px solid ${t.line}` : '0.5px solid transparent',
      background: scroll > 4 ? (t.dark ? 'rgba(14,14,16,0.85)' : 'rgba(245,242,236,0.85)') : 'transparent',
      backdropFilter: scroll > 4 ? 'blur(12px)' : 'none',
      transition: 'background 0.15s, border-color 0.15s',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack && (
            <button onClick={onBack} style={{
              width: 36, height: 36, borderRadius: 12, border: 'none',
              background: t.surface2, color: t.ink, display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <Icon.back width="18" height="18"/>
            </button>
          )}
          {leading}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {trailing}
        </div>
      </div>
      {large && title && (
        <div style={{ marginTop: 10 }}>
          <div style={{
            fontFamily: t.fontUI, fontWeight: 700,
            fontSize: 32 - shrink * 10, lineHeight: 1.1, color: t.ink,
            letterSpacing: -0.5, transition: 'font-size 0.15s',
          }}>{title}</div>
          {subtitle && (
            <div style={{
              marginTop: 4, fontSize: 13, color: t.ink3, fontFamily: t.fontUI,
            }}>{subtitle}</div>
          )}
        </div>
      )}
    </div>
  );
};

// Bottom tab bar
const TabBar = ({ t, active, onChange, cartCount, onCart }) => {
  const tabs = [
    { id: 'catalog', label: 'Sell', icon: Icon.grid },
    { id: 'orders', label: 'Orders', icon: Icon.clock },
    { id: 'customers', label: 'People', icon: Icon.user },
    { id: 'settings', label: 'Settings', icon: Icon.settings },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
      padding: '10px 14px 22px',
      background: t.dark ? 'rgba(14,14,16,0.88)' : 'rgba(245,242,236,0.92)',
      backdropFilter: 'blur(20px) saturate(180%)',
      borderTop: `0.5px solid ${t.line}`,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            flex: 1, border: 'none', background: 'transparent',
            padding: '6px 0 4px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 3, cursor: 'pointer',
            color: isActive ? t.accentDeep : t.ink3,
          }}>
            <tab.icon width="22" height="22"/>
            <span style={{ fontSize: 10.5, fontFamily: t.fontUI, fontWeight: 600, letterSpacing: 0.2 }}>{tab.label}</span>
          </button>
        );
      })}
      {/* Cart FAB — sits inside tab bar area */}
      {onCart && (
        <button onClick={onCart} style={{
          position: 'absolute', top: -26, right: 18,
          width: 56, height: 56, borderRadius: 28, border: 'none',
          background: t.ink, color: t.bg, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.15)',
          fontFamily: t.fontUI,
        }}>
          <Icon.bag width="22" height="22"/>
          {cartCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4, minWidth: 22, height: 22,
              borderRadius: 11, background: t.accent, color: '#1a1a1a',
              fontSize: 11, fontWeight: 700, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              padding: '0 6px', border: `2px solid ${t.dark ? '#0E0E10' : '#F5F2EC'}`,
            }}>{cartCount}</span>
          )}
        </button>
      )}
    </div>
  );
};

// Home indicator
const HomeIndicator = ({ t }) => (
  <div style={{
    position: 'absolute', bottom: 8, left: 0, right: 0, zIndex: 60,
    display: 'flex', justifyContent: 'center', pointerEvents: 'none',
  }}>
    <div style={{
      width: 139, height: 5, borderRadius: 100,
      background: t.dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.22)',
    }}/>
  </div>
);

// Dynamic island
const DynamicIsland = () => (
  <div style={{
    position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
    width: 126, height: 37, borderRadius: 24, background: '#000', zIndex: 50,
    pointerEvents: 'none',
  }} />
);

// Base device frame
const Phone = ({ t, children, label }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
    <div style={{
      width: 390, height: 844, borderRadius: 48, overflow: 'hidden',
      position: 'relative', background: t.bg,
      boxShadow: '0 32px 80px rgba(20, 15, 5, 0.18), 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 9px #1a1a1a, 0 0 0 10px rgba(255,255,255,0.08)',
      fontFamily: t.fontUI, color: t.ink,
      WebkitFontSmoothing: 'antialiased',
    }}>
      <DynamicIsland/>
      {children}
      <HomeIndicator t={t}/>
    </div>
    {label && (
      <div style={{
        fontFamily: t.fontMono, fontSize: 11, color: t.ink3,
        letterSpacing: 1, textTransform: 'uppercase',
      }}>{label}</div>
    )}
  </div>
);

Object.assign(window, { CounterStatusBar, NavBar, TabBar, HomeIndicator, DynamicIsland, Phone });
