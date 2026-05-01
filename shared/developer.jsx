// Shared developer/author info. Edit this once; it appears everywhere.
// Swap the DEVELOPER.* values with your real details.

const DEVELOPER = {
  name: 'Your Name',
  role: 'Designer & Developer',
  location: 'City, Country',
  email: 'you@yourdomain.com',
  phone: '+1 (555) 000-0000',
  website: 'yourdomain.com',
  socials: [
    { label: 'GitHub',   handle: '@yourhandle', url: 'https://github.com/yourhandle' },
    { label: 'X',        handle: '@yourhandle', url: 'https://x.com/yourhandle' },
    { label: 'LinkedIn', handle: 'your-name',   url: 'https://linkedin.com/in/your-name' },
  ],
};

// Small, neutral "Built by" card. Works on light and dark surfaces (pass variant).
// Usage: <DeveloperCard t={t} variant="light|dark|mobile"/>
const DeveloperCard = ({ t, variant = 'light', compact = false }) => {
  const dark = variant === 'dark';
  const mobile = variant === 'mobile';
  const bg = dark ? 'rgba(255,255,255,0.04)' : (mobile ? t.surface : t.surface);
  const border = dark ? 'rgba(255,255,255,0.1)' : t.line;
  const ink = dark ? '#F5F2EC' : t.ink;
  const ink2 = dark ? 'rgba(245,242,236,0.75)' : t.ink2;
  const ink3 = dark ? 'rgba(245,242,236,0.5)' : t.ink3;
  const accentFg = dark ? t.accent : t.accentDeep;

  return (
    <div style={{
      padding: compact ? 14 : 20, borderRadius: 14,
      background: bg, border: `0.5px solid ${border}`,
    }}>
      <div style={{
        fontFamily: t.fontMono, fontSize: 10, letterSpacing: 1.5,
        textTransform: 'uppercase', fontWeight: 700, color: accentFg,
      }}>Crafted by</div>
      <div style={{
        fontFamily: t.fontDisplay, fontSize: compact ? 20 : 24, fontWeight: 500,
        letterSpacing: -0.3, marginTop: 4, color: ink,
      }}>{DEVELOPER.name}</div>
      <div style={{ fontSize: 12, color: ink3, marginTop: 2 }}>
        {DEVELOPER.role} · {DEVELOPER.location}
      </div>

      <div style={{ height: 1, background: border, margin: '14px 0' }}/>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CKV t={t} k="Email"   v={DEVELOPER.email}   href={`mailto:${DEVELOPER.email}`}   ink={ink2} ink3={ink3}/>
        <CKV t={t} k="Phone"   v={DEVELOPER.phone}   href={`tel:${DEVELOPER.phone.replace(/\s/g,'')}`} ink={ink2} ink3={ink3}/>
        <CKV t={t} k="Web"     v={DEVELOPER.website} href={`https://${DEVELOPER.website}`} ink={ink2} ink3={ink3}/>
        {DEVELOPER.socials.map(s => (
          <CKV key={s.label} t={t} k={s.label} v={s.handle} href={s.url} ink={ink2} ink3={ink3}/>
        ))}
      </div>
    </div>
  );
};

const CKV = ({ t, k, v, href, ink, ink3 }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
    <div style={{ fontSize: 11, color: ink3, fontWeight: 600 }}>{k}</div>
    <a href={href} target="_blank" rel="noreferrer" style={{
      fontFamily: t.fontMono, fontSize: 12, color: ink, textDecoration: 'none', fontWeight: 500,
    }}>{v}</a>
  </div>
);

// Tiny single-line credit for footers / receipts / long-press Easter eggs.
const DeveloperLine = ({ t, muted, mono = true }) => (
  <span style={{
    fontFamily: mono ? t.fontMono : 'inherit',
    fontSize: 10, color: muted || t.ink3, letterSpacing: 0.5,
  }}>
    Built by {DEVELOPER.name} · <a href={`mailto:${DEVELOPER.email}`} style={{ color: 'inherit', textDecoration: 'none', borderBottom: '0.5px solid currentColor' }}>{DEVELOPER.email}</a>
  </span>
);

Object.assign(window, { DEVELOPER, DeveloperCard, DeveloperLine });
