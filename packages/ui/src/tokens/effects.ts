export const radius = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  pill: '9999px',
} as const;

export const shadow = {
  none: 'none',
  hairline: '0 0 0 1px rgb(15 23 42 / 0.06)',
  soft: '0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)',
  raised: '0 4px 8px rgb(15 23 42 / 0.06), 0 2px 4px rgb(15 23 42 / 0.04)',
  overlay: '0 16px 32px rgb(15 23 42 / 0.12)',
  focus: '0 0 0 3px var(--ui-color-brand-primary-subtle, rgb(14 34 68 / 0.25))',
} as const;

export const motion = {
  duration: {
    instant: '80ms',
    quick: '150ms',
    base: '220ms',
    slow: '320ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasised: 'cubic-bezier(0.3, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0, 1)',
    accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  },
} as const;

export const zIndex = {
  base: 0,
  sticky: 10,
  dropdown: 20,
  popover: 30,
  modal: 40,
  toast: 50,
} as const;
