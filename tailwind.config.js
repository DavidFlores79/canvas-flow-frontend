/** @type {import('tailwindcss').Config} */
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
          DEFAULT: '#1e1b4b',
          hover:   '#2d2a6e',
          active:  '#3730a3',
          border:  '#312e81',
          header:  '#13113a',
        },
        surface: {
          DEFAULT: '#0f0e2a',
          muted:   '#1a1847',
        },
        ink: {
          primary:   '#ede9fe',
          secondary: '#a5b4fc',
          disabled:  '#6366f1',
        },
        accent: {
          DEFAULT: '#8b5cf6',
          hover:   '#7c3aed',
          muted:   '#4c1d95',
          light:   '#c4b5fd',
        },
        brand: {
          from: '#8b5cf6',
          to:   '#312e81',
        },
        canvas: {
          desk:    '#e2e8f0',
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
