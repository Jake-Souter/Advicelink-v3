export const typography = {
  fontFamily: {
    sans: 'var(--ui-font-family-sans, Inter, system-ui, sans-serif)',
    display: 'var(--ui-font-family-display, Inter, system-ui, sans-serif)',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.8125rem',
    body: '0.875rem',
    md: '0.9375rem',
    lg: '1.0625rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  lineHeight: {
    tight: 1.2,
    body: 1.45,
    relaxed: 1.6,
  },
  letterSpacing: {
    tight: '-0.01em',
    normal: '0',
    wide: '0.02em',
  },
} as const;
