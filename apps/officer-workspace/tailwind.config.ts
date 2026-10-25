import type { Config } from 'tailwindcss';

// Token map only. All colour/shadow/radius values resolve to the CSS
// variables declared in src/styles/tokens.css (single source of truth,
// light + dark via :root[data-theme]). Tailwind is used for spacing and
// layout; do not add colour literals here or in tsx.
//
// Note: the app runs Tailwind v4 via @config compat (see src/index.css).
// v4 accepts var() references in theme values and emits them verbatim.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces
        'surface-body': 'var(--surface-body)',
        'surface-body-alt': 'var(--surface-body-alt)',
        'surface-card': 'var(--surface-card)',
        'surface-card-hover': 'var(--surface-card-hover)',
        'surface-raised': 'var(--surface-raised)',
        'surface-sunken': 'var(--surface-sunken)',
        'surface-input': 'var(--surface-input)',
        // Text levels
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-invert': 'var(--text-invert)',
        // Borders
        'border-default': 'var(--border-default)',
        'border-subtle': 'var(--border-subtle)',
        // Brand (MARA orange)
        primary: {
          DEFAULT: 'var(--primary)',
          soft: 'var(--primary-soft)',
          hover: 'var(--primary-hover)',
          contrast: 'var(--primary-contrast)',
        },
        // Semantic pairs
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)' },
        purple: { DEFAULT: 'var(--purple)', soft: 'var(--purple-soft)' },
        pink: { DEFAULT: 'var(--pink)', soft: 'var(--pink-soft)' },
        teal: { DEFAULT: 'var(--teal)', soft: 'var(--teal-soft)' },
        orange: { DEFAULT: 'var(--orange)', soft: 'var(--orange-soft)' },
        // Misc
        overlay: 'var(--overlay)',
        'focus-ring': 'var(--focus-ring)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        card: 'var(--shadow-card)',
        DEFAULT: 'var(--shadow-card)',
        lg: 'var(--shadow-lg)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
    },
  },
} satisfies Config;
