// Counter Web — landing + dashboard, designed to share tokens with the mobile app

function WebTokens() {
  const accent = 'oklch(0.72 0.14 70)';
  const accentDeep = 'oklch(0.55 0.16 70)';
  const accentSoft = 'oklch(0.94 0.05 70)';
  return {
    bg: '#F5F2EC', surface: '#FFFFFF', surface2: '#FBF8F2',
    ink: '#161615', ink2: '#4A4842', ink3: '#8B887F',
    line: 'rgba(0,0,0,0.07)', line2: 'rgba(0,0,0,0.12)',
    accent, accentDeep, accentSoft,
    ok: '#4BA971', warn: '#D4A842', bad: '#D84C3F',
    fontUI: '"Inter", -apple-system, system-ui, sans-serif',
    fontMono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
    fontDisplay: '"Fraunces", Georgia, serif',
  };
}

const WIcon = {
  logo: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 4L3 12l3 8M18 4l3 8-3 8"/><path d="M10 8l-2 4 2 4M14 8l2 4-2 4"/></svg>,
  arrow: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14m0 0l-6-6m6 6l-6 6"/></svg>,
  download: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16"/></svg>,
  check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12l5 5L20 7"/></svg>,
  cloud: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 18a5 5 0 010-10 6 6 0 0111.5 2A4 4 0 0118 18H7z"/></svg>,
  device: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 19h2"/></svg>,
  chart: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 20V8M10 20V4M16 20v-8M22 20H2"/></svg>,
  lock: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>,
  bolt: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>,
  home: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V11z"/></svg>,
  box: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>,
  people: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="8" r="3.5"/><path d="M3 21a6 6 0 0112 0"/><circle cx="17" cy="7" r="3"/><path d="M15 21a6 6 0 017-5.5"/></svg>,
  receipt: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>,
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>,
  pin: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>,
  dot: (p) => <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
};

// Shared product/customer placeholder
const WThumb = ({ name, swatch = ['#D4C9B4', '#9A907A'], size = 36 }) => {
  const [a, b] = swatch;
  const id = `w-${name.replace(/\W/g, '')}`;
  const initials = name.split(' ').slice(0,2).map(x=>x[0]).join('');
  const radius = typeof size === 'number' ? size / 6 : 6;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ borderRadius: radius, display: 'block', flexShrink: 0 }}>
      <defs><pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <rect width="8" height="8" fill={b}/><rect width="4" height="8" fill={a}/>
      </pattern></defs>
      <rect width="64" height="64" rx="10" fill={`url(#${id})`}/>
      <rect width="64" height="64" rx="10" fill="rgba(0,0,0,0.06)"/>
      <text x="32" y="39" textAnchor="middle" fontFamily='"JetBrains Mono", monospace' fontSize="18" fontWeight="700" fill="rgba(255,255,255,0.85)">{initials}</text>
    </svg>
  );
};

Object.assign(window, { WebTokens, WIcon, WThumb });
