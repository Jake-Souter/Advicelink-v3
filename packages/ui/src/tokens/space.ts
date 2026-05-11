/** 4px grid spacing scale. See REBUILD_PLAN §11.6.2. */
export const space = {
  0: '0',
  1: '0.25rem', // 4
  2: '0.5rem', // 8
  3: '0.75rem', // 12
  4: '1rem', // 16
  5: '1.25rem', // 20
  6: '1.5rem', // 24
  8: '2rem', // 32
  10: '2.5rem', // 40
  12: '3rem', // 48
  16: '4rem', // 64
} as const;

/** Semantic widths/heights surfaced as named tokens. */
export const size = {
  sidebar: { width: '15.5rem' /* 248px */ },
  navItem: { height: '2.25rem' /* 36px */ },
  table: { rowHeight: '3rem' /* 48px */ },
  card: { maxWidth: '80rem' /* 1280px */ },
  loginCard: { maxWidth: '26rem' /* 416px */ },
} as const;
