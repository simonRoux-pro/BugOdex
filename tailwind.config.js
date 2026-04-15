/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50:  '#f0faf4',
          100: '#dcf4e6',
          200: '#bbeacf',
          300: '#8dd9af',
          400: '#58c088',
          500: '#34a168',
          600: '#258252',
          700: '#1f6843',
          800: '#1c5237',
          900: '#19442f',
        },
      },
    },
  },
  plugins: [],
}
