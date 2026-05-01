// Landing page — hero, features, sync story, pricing, footer

const Landing = ({ t, onEnterApp }) => (
  <div style={{ background: t.bg, color: t.ink, fontFamily: t.fontUI }}>
    <LandingNav t={t} onEnterApp={onEnterApp}/>
    <LandingHero t={t} onEnterApp={onEnterApp}/>
    <FeatureStrip t={t}/>
    <SyncStory t={t}/>
    <Pricing t={t} onEnterApp={onEnterApp}/>
    <DownloadStrip t={t}/>
    <LandingFooter t={t}/>
  </div>
);

const LandingNav = ({ t, onEnterApp }) => (
  <nav style={{
    position: 'sticky', top: 0, zIndex: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 48px', background: 'rgba(245,242,236,0.85)',
    backdropFilter: 'blur(18px) saturate(180%)',
    borderBottom: `0.5px solid ${t.line}`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <WIcon.logo width="22" height="22" style={{ color: t.ink }}/>
      <span style={{ fontFamily: t.fontMono, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Counter</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
      {['Features', 'Sync', 'Pricing', 'Changelog'].map(l => (
        <a key={l} href={`#${l.toLowerCase()}`} style={{ fontSize: 13, color: t.ink2, textDecoration: 'none', fontWeight: 500 }}>{l}</a>
      ))}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button style={{
        padding: '9px 14px', borderRadius: 10, border: 'none',
        background: 'transparent', color: t.ink, cursor: 'pointer', fontSize: 13, fontWeight: 600,
      }}>Sign in</button>
      <button onClick={onEnterApp} style={{
        padding: '9px 14px', borderRadius: 10, border: 'none',
        background: t.ink, color: t.bg, cursor: 'pointer', fontSize: 13, fontWeight: 600,
      }}>Open dashboard →</button>
    </div>
  </nav>
);

const LandingHero = ({ t, onEnterApp }) => (
  <section style={{
    padding: '80px 48px 40px', display: 'grid',
    gridTemplateColumns: '1fr 720px', gap: 40, alignItems: 'center',
    maxWidth: 1440, margin: '0 auto',
  }}>
    <div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 999, background: t.accentSoft,
        color: t.accentDeep, fontFamily: t.fontMono, fontSize: 11,
        letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 22,
      }}><WIcon.dot width="8" height="8"/>Now with cloud sync · v1.5</div>
      <h1 style={{
        margin: 0, fontFamily: t.fontDisplay, fontWeight: 500,
        fontSize: 72, lineHeight: 1, letterSpacing: -1.5, color: t.ink,
      }}>
        A calm POS,<br/>
        <span style={{ fontStyle: 'italic', color: t.accentDeep }}>everywhere</span> you sell.
      </h1>
      <p style={{
        marginTop: 22, fontSize: 17, lineHeight: 1.55, color: t.ink2, maxWidth: 500,
      }}>
        Counter runs on the phone in your apron, the iPad on your counter, and the laptop at the back office. One account. One catalog. One sync.
      </p>
      <div style={{ marginTop: 28, display: 'flex', gap: 10 }}>
        <button style={{
          height: 52, padding: '0 22px', borderRadius: 13, border: 'none',
          background: t.ink, color: t.bg, cursor: 'pointer', fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <WIcon.download width="18" height="18"/>
          Download APK · v1.5.2
        </button>
        <button onClick={onEnterApp} style={{
          height: 52, padding: '0 22px', borderRadius: 13,
          border: `1px solid ${t.line2}`, background: 'transparent',
          color: t.ink, cursor: 'pointer', fontSize: 14, fontWeight: 600,
        }}>Open web dashboard</button>
      </div>
      <div style={{ marginTop: 18, fontSize: 12, color: t.ink3, display: 'flex', gap: 18 }}>
        <span>✓ Free plan · no credit card</span>
        <span>✓ Works offline</span>
        <span>✓ Android 9+</span>
      </div>
    </div>
    <HeroDualDevice t={t}/>
  </section>
);

// The money shot: phone + web browser showing identical data
const HeroDualDevice = ({ t }) => (
  <div style={{ position: 'relative', height: 560, width: 720, maxWidth: '100%' }}>
    {/* Laptop / browser window */}
    <div style={{
      position: 'absolute', top: 20, left: 0, width: 520, height: 360,
      borderRadius: 14, background: t.surface, overflow: 'hidden',
      boxShadow: '0 40px 80px rgba(20,15,5,0.18), 0 0 0 1px rgba(0,0,0,0.08)',
    }}>
      <MiniBrowserChrome t={t}/>
      <MiniDashboard t={t}/>
    </div>
    {/* Phone */}
    <div style={{
      position: 'absolute', top: 110, left: 500, width: 210, height: 440,
      borderRadius: 32, background: t.bg, overflow: 'hidden',
      boxShadow: '0 32px 60px rgba(20,15,5,0.22), 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 7px #1a1a1a',
    }}>
      <div style={{
        position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
        width: 70, height: 22, borderRadius: 14, background: '#000', zIndex: 5,
      }}/>
      <MiniPhoneCatalog t={t}/>
    </div>
    {/* Sync pill between them */}
    <div style={{
      position: 'absolute', top: 250, left: 430, zIndex: 10,
      padding: '8px 14px', borderRadius: 999,
      background: t.ink, color: t.bg,
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 11, fontFamily: t.fontMono, letterSpacing: 0.5,
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: 4, background: '#4BA971',
        boxShadow: '0 0 0 3px rgba(75,169,113,0.3)',
      }}/>
      LIVE SYNC · 43ms
    </div>
  </div>
);

const MiniBrowserChrome = ({ t }) => (
  <div style={{
    padding: '10px 14px', borderBottom: `0.5px solid ${t.line}`,
    background: t.surface2, display: 'flex', alignItems: 'center', gap: 12,
  }}>
    <div style={{ display: 'flex', gap: 6 }}>
      {['#FF5F57', '#FEBC2E', '#28C841'].map(c => (
        <div key={c} style={{ width: 10, height: 10, borderRadius: 5, background: c }}/>
      ))}
    </div>
    <div style={{
      flex: 1, height: 22, borderRadius: 5, background: t.bg, border: `0.5px solid ${t.line}`,
      fontFamily: t.fontMono, fontSize: 10.5, color: t.ink3,
      display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6,
    }}>
      <WIcon.lock width="10" height="10"/>
      app.counter.app/dashboard
    </div>
  </div>
);

const MiniDashboard = ({ t }) => (
  <div style={{ padding: 16, height: 'calc(100% - 40px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div>
        <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 500 }}>Good afternoon, Ana</div>
        <div style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>Field Studio · Register 01 active now</div>
      </div>
      <div style={{
        padding: '4px 10px', borderRadius: 999, background: t.accentSoft, color: t.accentDeep,
        fontFamily: t.fontMono, fontSize: 10, fontWeight: 600,
      }}>PRO PLAN</div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {[
        { label: 'Today', v: '$1,284', sub: '+12%' },
        { label: 'Orders', v: '47', sub: '21 in last hour' },
        { label: 'Avg ticket', v: '$27.30', sub: '—' },
        { label: 'Inventory', v: '247', sub: '6 low' },
      ].map(s => (
        <div key={s.label} style={{
          padding: '10px 12px', borderRadius: 10, background: t.surface2, border: `0.5px solid ${t.line}`,
        }}>
          <div style={{ fontSize: 9, color: t.ink3, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{s.label}</div>
          <div style={{ fontFamily: t.fontMono, fontSize: 16, fontWeight: 700, marginTop: 2 }}>{s.v}</div>
          <div style={{ fontSize: 9, color: t.ink3, marginTop: 1 }}>{s.sub}</div>
        </div>
      ))}
    </div>

    <div style={{ flex: 1, padding: 12, borderRadius: 10, background: t.surface2, border: `0.5px solid ${t.line}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: t.ink2, marginBottom: 8 }}>Sales · last 24h</div>
      <Sparkline t={t} height={110}/>
    </div>
  </div>
);

const Sparkline = ({ t, height = 120 }) => {
  const pts = [6, 9, 7, 14, 11, 18, 22, 19, 26, 24, 30, 28, 34, 31, 38, 42, 40, 46, 52, 48, 55, 58, 54, 60];
  const max = 70;
  const w = 600;
  const path = pts.map((p, i) => `${(i / (pts.length - 1)) * w},${height - (p / max) * height}`).join(' L');
  const area = `M0,${height} L${path} L${w},${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <path d={area} fill={t.accentSoft} opacity="0.8"/>
      <path d={`M${path}`} fill="none" stroke={t.accentDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p, i) => i % 4 === 0 && (
        <circle key={i} cx={(i / (pts.length - 1)) * w} cy={height - (p / max) * height} r="3" fill={t.surface} stroke={t.accentDeep} strokeWidth="1.5"/>
      ))}
    </svg>
  );
};

const MiniPhoneCatalog = ({ t }) => (
  <div style={{ padding: '48px 12px 16px', height: '100%', background: t.bg, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div>
      <div style={{ fontSize: 11, color: t.ink3 }}>Register 01</div>
      <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 500, letterSpacing: -0.3 }}>Sell</div>
    </div>
    <div style={{ height: 32, borderRadius: 10, background: t.surface2, border: `0.5px solid ${t.line}`, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6 }}>
      <WIcon.search width="12" height="12" style={{ color: t.ink3 }}/>
      <span style={{ fontSize: 10, color: t.ink3 }}>Search products…</span>
    </div>
    <div style={{ display: 'flex', gap: 4 }}>
      {['All', 'Drinks', 'Food', 'Gifts'].map((c, i) => (
        <div key={c} style={{
          padding: '4px 10px', borderRadius: 999, fontSize: 9, fontWeight: 600,
          background: i === 0 ? t.ink : t.surface2,
          color: i === 0 ? t.bg : t.ink2,
        }}>{c}</div>
      ))}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, flex: 1 }}>
      {[
        { n: 'Oat Flat White', p: '$4.80', sw: ['#C9AA85', '#F3E6D3'] },
        { n: 'Heavyweight Tee', p: '$32.00', sw: ['#2B2B2E', '#E8E4DB'] },
        { n: 'Sourdough Loaf', p: '$8.50', sw: ['#C89B5C', '#EBD4A6'] },
        { n: 'Matcha Latte', p: '$5.50', sw: ['#8FA678', '#C5D4B0'] },
      ].map(it => (
        <div key={it.n} style={{ padding: 5, borderRadius: 8, background: t.surface, border: `0.5px solid ${t.line}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 6, overflow: 'hidden' }}>
            <WThumb name={it.n} swatch={it.sw} size="100%"/>
          </div>
          <div style={{ padding: '0 2px 2px' }}>
            <div style={{ fontSize: 9, fontWeight: 600, lineHeight: 1.2 }}>{it.n}</div>
            <div style={{ fontFamily: t.fontMono, fontSize: 9, fontWeight: 600, marginTop: 1 }}>{it.p}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const FeatureStrip = ({ t }) => (
  <section id="features" style={{ padding: '80px 48px', maxWidth: 1280, margin: '0 auto' }}>
    <div style={{ textAlign: 'center', marginBottom: 48 }}>
      <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.accentDeep, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>Why Counter</div>
      <h2 style={{ fontFamily: t.fontDisplay, fontSize: 44, fontWeight: 500, letterSpacing: -0.8, margin: '12px 0 0' }}>Every feature a small shop needs.</h2>
      <p style={{ fontSize: 15, color: t.ink2, marginTop: 12 }}>Nothing extra. Nothing missing.</p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {[
        { icon: WIcon.bolt, title: 'Built for speed', body: 'Variant pickers, modifiers, and a thermal receipt print in under two seconds.' },
        { icon: WIcon.cloud, title: 'Offline-first, cloud-safe', body: 'Keep selling through outages. We sync the second you\'re back online.' },
        { icon: WIcon.device, title: 'Phone, tablet, web', body: 'One account, every surface. Open a shift on your phone, close it on your laptop.' },
        { icon: WIcon.chart, title: 'Reports that decide', body: 'Hourly sales, top items, cash variance — in plain language, not a data dump.' },
        { icon: WIcon.people, title: 'Customers & loyalty', body: 'Punchcard-style points, tags, notes. No apps required for shoppers.' },
        { icon: WIcon.lock, title: 'Your data, yours', body: 'Export to CSV any time. Delete it any time. No lock-in.' },
      ].map(f => (
        <div key={f.title} style={{
          padding: 24, borderRadius: 18, background: t.surface, border: `0.5px solid ${t.line}`,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: t.accentSoft, color: t.accentDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <f.icon width="20" height="20"/>
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: t.ink }}>{f.title}</div>
          <p style={{ fontSize: 13.5, color: t.ink2, lineHeight: 1.55, marginTop: 6 }}>{f.body}</p>
        </div>
      ))}
    </div>
  </section>
);

const SyncStory = ({ t }) => (
  <section id="sync" style={{ padding: '80px 48px', background: t.ink, color: t.bg }}>
    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
      <div>
        <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.accent, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>Sync</div>
        <h2 style={{ fontFamily: t.fontDisplay, fontSize: 48, fontWeight: 500, letterSpacing: -0.8, margin: '12px 0 20px', lineHeight: 1.1 }}>
          One account.<br/>
          <span style={{ fontStyle: 'italic', color: t.accent }}>Every counter.</span>
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(245,242,236,0.75)', maxWidth: 460 }}>
          Sign in on a phone and the web at the same time. Add a product in the browser — it appears on the register before the barista finishes their cappuccino. Ring up a sale at the counter — the dashboard total ticks up in real time.
        </p>
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            'Real-time product & price sync across all devices',
            'Open shifts visible from the web — end remotely if needed',
            'Conflict-free offline edits with last-write-wins reconciliation',
            'End-to-end encrypted backups, stored in your region',
          ].map(l => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'rgba(245,242,236,0.9)' }}>
              <WIcon.check width="16" height="16" style={{ color: t.accent, flexShrink: 0 }}/>
              {l}
            </div>
          ))}
        </div>
      </div>
      <SyncDiagram t={t}/>
    </div>
  </section>
);

const SyncDiagram = ({ t }) => (
  <div style={{ position: 'relative', height: 420 }}>
    <svg viewBox="0 0 500 420" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={t.accent} stopOpacity="0.4"/>
          <stop offset="100%" stopColor={t.accent} stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="250" cy="210" r="120" fill="url(#glow)"/>
      <circle cx="250" cy="210" r="40" fill="none" stroke={t.accent} strokeOpacity="0.4" strokeDasharray="3,4"/>
      <circle cx="250" cy="210" r="80" fill="none" stroke={t.accent} strokeOpacity="0.2" strokeDasharray="3,4"/>
      <circle cx="250" cy="210" r="120" fill="none" stroke={t.accent} strokeOpacity="0.1" strokeDasharray="3,4"/>

      {/* connection lines */}
      {[
        [90, 100], [410, 100], [90, 320], [410, 320],
      ].map(([x, y], i) => (
        <line key={i} x1={250} y1={210} x2={x} y2={y} stroke={t.accent} strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2,3"/>
      ))}

      {/* center cloud */}
      <g transform="translate(230, 190)">
        <rect width="40" height="40" rx="10" fill={t.accent}/>
        <g transform="translate(8, 8)" stroke="#1a1a1a" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 16a4 4 0 010-8 5 5 0 0110 1.5A3.5 3.5 0 0116 16H7z"/>
        </g>
      </g>
      <text x="250" y="280" textAnchor="middle" fontFamily='"JetBrains Mono", monospace' fontSize="10" fill="rgba(245,242,236,0.6)" letterSpacing="1">COUNTER CLOUD</text>
    </svg>

    {/* device nodes */}
    {[
      { x: 40, y: 70, label: 'Phone · Counter Ana', sub: 'Register 01 · live', h: 60 },
      { x: 360, y: 70, label: 'Web · Back office', sub: 'Chrome · macOS', h: 60 },
      { x: 40, y: 290, label: 'Tablet · Counter B', sub: 'Register 02 · live', h: 60 },
      { x: 360, y: 290, label: 'Printer · TSP143', sub: 'Bluetooth · 88%', h: 60 },
    ].map((n, i) => (
      <div key={i} style={{
        position: 'absolute', left: n.x, top: n.y, width: 110, height: n.h,
        padding: '10px 12px', borderRadius: 12,
        background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)',
        fontSize: 10, backdropFilter: 'blur(10px)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{n.label}</div>
        <div style={{ fontFamily: t.fontMono, fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{n.sub}</div>
      </div>
    ))}
  </div>
);

const Pricing = ({ t, onEnterApp }) => (
  <section id="pricing" style={{ padding: '80px 48px', maxWidth: 1280, margin: '0 auto' }}>
    <div style={{ textAlign: 'center', marginBottom: 48 }}>
      <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.accentDeep, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>Pricing</div>
      <h2 style={{ fontFamily: t.fontDisplay, fontSize: 44, fontWeight: 500, letterSpacing: -0.8, margin: '12px 0 0' }}>Free at the counter. Pay for the cloud.</h2>
      <p style={{ fontSize: 15, color: t.ink2, marginTop: 12, maxWidth: 560, margin: '12px auto 0' }}>
        The mobile app is free forever — your shop never stops if you don't pay. Upgrade when you want sync, web access, and reports.
      </p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <PriceCard t={t} tier="Free" price="$0" sub="forever"
        blurb="The full mobile POS, stored locally on your phone. One register."
        features={['Unlimited products & sales', 'Variants, modifiers, discounts', 'Thermal printer support', 'CSV import/export', '1 register · local only']}
        cta="Download APK"/>
      <PriceCard t={t} tier="Pro" price="$29" sub="per month"
        featured blurb="Everything synced to the cloud, plus the web dashboard."
        features={['Everything in Free', 'Cloud sync · real-time', 'Web dashboard & reports', 'Unlimited registers · 1 location', 'Automatic backups · 90 days', 'Email support']}
        cta="Start 14-day trial" onCtaClick={onEnterApp}/>
      <PriceCard t={t} tier="Business" price="$79" sub="per month"
        blurb="For shops with more than one location or a team."
        features={['Everything in Pro', 'Unlimited locations', 'Team roles & permissions', 'Advanced reports & exports', 'REST API + webhooks', 'Priority support']}
        cta="Contact sales"/>
    </div>
    <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: t.ink3 }}>
      All plans · Card processing fees billed separately by your provider · Cancel any time
    </div>
  </section>
);

const PriceCard = ({ t, tier, price, sub, blurb, features, cta, featured, onCtaClick }) => (
  <div style={{
    padding: 28, borderRadius: 20,
    background: featured ? t.ink : t.surface,
    color: featured ? t.bg : t.ink,
    border: featured ? 'none' : `0.5px solid ${t.line}`,
    position: 'relative',
    boxShadow: featured ? '0 24px 48px rgba(20,15,5,0.15)' : 'none',
  }}>
    {featured && (
      <div style={{
        position: 'absolute', top: -12, right: 24, padding: '5px 12px', borderRadius: 999,
        background: t.accent, color: '#1a1a1a', fontSize: 10, fontWeight: 700,
        letterSpacing: 1, textTransform: 'uppercase', fontFamily: t.fontMono,
      }}>Most popular</div>
    )}
    <div style={{ fontSize: 13, fontWeight: 600, color: featured ? 'rgba(245,242,236,0.7)' : t.ink3 }}>{tier}</div>
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontFamily: t.fontDisplay, fontSize: 48, fontWeight: 500, letterSpacing: -1 }}>{price}</span>
      <span style={{ fontSize: 13, color: featured ? 'rgba(245,242,236,0.6)' : t.ink3 }}>{sub}</span>
    </div>
    <p style={{ fontSize: 13.5, lineHeight: 1.5, color: featured ? 'rgba(245,242,236,0.7)' : t.ink2, marginTop: 10 }}>{blurb}</p>
    <div style={{ height: 1, background: featured ? 'rgba(255,255,255,0.12)' : t.line, margin: '20px 0' }}/>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {features.map(f => (
        <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: featured ? 'rgba(245,242,236,0.9)' : t.ink2 }}>
          <WIcon.check width="16" height="16" style={{ color: featured ? t.accent : t.accentDeep, flexShrink: 0, marginTop: 1 }}/>
          {f}
        </div>
      ))}
    </div>
    <button onClick={onCtaClick} style={{
      marginTop: 24, width: '100%', height: 48, borderRadius: 12, border: 'none',
      background: featured ? t.accent : 'transparent',
      color: featured ? '#1a1a1a' : t.ink,
      border: featured ? 'none' : `1px solid ${t.line2}`,
      cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
    }}>{cta}</button>
  </div>
);

const DownloadStrip = ({ t }) => (
  <section style={{ padding: '60px 48px' }}>
    <div style={{
      maxWidth: 1120, margin: '0 auto', padding: 40, borderRadius: 24,
      background: t.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40,
    }}>
      <div>
        <h3 style={{ fontFamily: t.fontDisplay, fontSize: 32, fontWeight: 500, letterSpacing: -0.5, margin: 0 }}>Get Counter on your phone</h3>
        <p style={{ fontSize: 14, color: t.ink2, marginTop: 8, maxWidth: 480 }}>
          Sideload the APK directly, or wait for the Play Store release next month. iOS in beta.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <StoreBtn t={t} big="Download APK" small="Android 9+ · 14 MB" icon={WIcon.download}/>
        <StoreBtn t={t} big="iOS · Beta" small="TestFlight · by invite" icon={WIcon.device}/>
      </div>
    </div>
  </section>
);

const StoreBtn = ({ t, big, small, icon: Ic }) => (
  <button style={{
    padding: '12px 20px', borderRadius: 14, border: 'none', background: t.ink, color: t.bg,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
  }}>
    <Ic width="22" height="22"/>
    <div>
      <div style={{ fontSize: 10, color: 'rgba(245,242,236,0.6)', letterSpacing: 0.5 }}>{small}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{big}</div>
    </div>
  </button>
);

const LandingFooter = ({ t }) => (
  <footer style={{ borderTop: `0.5px solid ${t.line}`, background: t.surface2 }}>
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 48px 24px', display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 60, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <WIcon.logo width="20" height="20"/>
          <span style={{ fontFamily: t.fontMono, fontSize: 12, letterSpacing: 1.5, fontWeight: 700, textTransform: 'uppercase' }}>Counter · v1.5.2</span>
        </div>
        <p style={{ fontSize: 13, color: t.ink2, lineHeight: 1.55, maxWidth: 380, margin: 0 }}>
          An independent POS for independent shops. Made with care, not venture capital.
        </p>
        <div style={{ display: 'flex', gap: 24, marginTop: 24, fontSize: 12, color: t.ink3 }}>
          {['Changelog', 'Docs', 'Status', 'Privacy', 'Terms'].map(l => (
            <a key={l} href="#" style={{ color: t.ink3, textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
      </div>
      <DeveloperCard t={t} variant="light"/>
    </div>
    <div style={{ borderTop: `0.5px solid ${t.line}`, padding: '16px 48px', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.ink3, fontFamily: t.fontMono }}>
      <div>© 2026 Counter POS · Built by {DEVELOPER.name}</div>
      <div>v1.5.2 · {DEVELOPER.website}</div>
    </div>
  </footer>
);

Object.assign(window, { Landing });
