import type { Config } from 'tailwindcss';

// Dark surface palette lives in src/index.css (@theme) so the values are real
// CSS custom properties at runtime, not build-time-only config. Do not add
// colour literals back here.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
} satisfies Config;
