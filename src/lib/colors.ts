/** Central colour palette — import from here, never hard-code hex strings in components */
export const C = {
  // Brand
  accent:          '#ff8a00',
  accentBg:        'rgba(255,138,0,0.1)',
  accentBgHover:   'rgba(255,138,0,0.15)',
  accentBorder:    'rgba(255,138,0,0.35)',
  accentBorderDim: 'rgba(255,138,0,0.25)',
  accentDim:       'rgba(255,138,0,0.6)',
  accentGlow:      'rgba(255,138,0,0.5)',

  // Backgrounds
  bgDeep:    '#07060b',
  bgDark:    '#08070c',
  bgCard:    '#0d0c14',
  bgSurface: 'rgba(255,255,255,0.03)',
  bgHover:   'rgba(255,255,255,0.04)',
  bgActive:  'rgba(255,255,255,0.06)',

  // Borders
  border:       'rgba(255,255,255,0.08)',
  borderSubtle: 'rgba(255,255,255,0.06)',
  borderFaint:  'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.12)',

  // Text
  textPrimary:   'rgba(255,255,255,0.85)',
  textSecondary: 'rgba(255,255,255,0.55)',
  textMuted:     'rgba(255,255,255,0.28)',
  textDim:       'rgba(255,255,255,0.22)',
  textFaint:     'rgba(255,255,255,0.15)',

  // Game events / status
  kill:    '#ef4444',
  death:   '#f97316',
  botKill: '#ec4899',
  storm:   '#a855f7',
  loot:    '#22c55e',
  human:   '#60a5fa',
  bot:     '#ff8a00',

  // Danger state
  danger:       '#f87171',
  dangerBg:     'rgba(239,68,68,0.06)',
  dangerBorder: 'rgba(239,68,68,0.25)',
} as const;
