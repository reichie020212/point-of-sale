// Design tokens — resolved at runtime from Tweaks
function useTokens(tweaks) {
  const dark = tweaks.dark;
  const accentH = tweaks.accentHue;      // oklch hue
  const density = tweaks.density;        // 'cozy' | 'compact'

  const accent = `oklch(0.72 0.14 ${accentH})`;
  const accentDeep = `oklch(0.55 0.16 ${accentH})`;
  const accentSoft = `oklch(0.94 0.05 ${accentH})`;
  const accentSoftDark = `oklch(0.26 0.05 ${accentH})`;

  // neutrals — warm off-white / near black
  const bg       = dark ? '#0E0E10' : '#F5F2EC';
  const surface  = dark ? '#1A1A1D' : '#FFFFFF';
  const surface2 = dark ? '#242428' : '#FBF8F2';
  const ink      = dark ? '#F5F2EC' : '#161615';
  const ink2     = dark ? '#C8C4BB' : '#4A4842';
  const ink3     = dark ? '#8B887F' : '#8B887F';
  const line     = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const line2    = dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';

  const sizes = density === 'compact'
    ? { rowH: 48, cardPad: 12, gap: 8, cardGap: 10, radius: 14 }
    : { rowH: 56, cardPad: 14, gap: 12, cardGap: 12, radius: 16 };

  return {
    dark,
    accent, accentDeep, accentSoft: dark ? accentSoftDark : accentSoft,
    bg, surface, surface2, ink, ink2, ink3, line, line2,
    ...sizes,
    fontUI: '"Inter", -apple-system, system-ui, sans-serif',
    fontMono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
  };
}

window.useTokens = useTokens;
