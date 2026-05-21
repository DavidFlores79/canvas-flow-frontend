/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f3f0ff',
          100: '#ede8ff',
          200: '#dbd4fe',
          300: '#beb2fd',
          400: '#9d87fa',
          500: '#7C3AED',
          600: '#6D28D9',
          700: '#5B21B6',
          800: '#3d1a8a',
          900: '#2D2463',
        },
      },
    },
  },
  plugins: [],
}

