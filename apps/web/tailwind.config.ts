import type { Config } from 'tailwindcss';
import preset from '@advicelink/ui/tailwind-preset';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  presets: [preset],
} satisfies Config;
