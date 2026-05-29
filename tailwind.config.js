/** @type {import('tailwindcss').Config} */
const rgb = (v) => `rgb(var(${v}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{html,ts}"],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        panel: {
          DEFAULT: rgb('--panel'),
          hover:   rgb('--panel-hover'),
          active:  rgb('--panel-active'),
          border:  rgb('--panel-border'),
          header:  rgb('--panel-header'),
        },
        surface: {
          DEFAULT: rgb('--surface'),
          muted:   rgb('--surface-muted'),
        },
        ink: {
          primary:   rgb('--ink-primary'),
          secondary: rgb('--ink-secondary'),
          disabled:  rgb('--ink-disabled'),
        },
        accent: {
          DEFAULT: rgb('--accent'),
          hover:   rgb('--accent-hover'),
          muted:   rgb('--accent-muted'),
          light:   rgb('--accent-light'),
        },
        brand: {
          from: '#8b5cf6',
          to:   '#312e81',
        },
        canvas: {
          desk:    rgb('--canvas-desk'),
          surface: '#ffffff',
        },
        danger:  '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
      },
      boxShadow: {
        panel: '0 2px 8px 0 rgba(0,0,0,0.4)',
        float: '0 4px 24px 0 rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
