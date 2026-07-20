/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f7f5f2',
          100: '#ece7de',
          200: '#d9cfbd',
          300: '#c0af93',
          400: '#a68c6a',
          500: '#8a6f4e',
          600: '#6f5940',
          700: '#584636',
          800: '#3d3025',
          900: '#241c16',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
    },
  },
  plugins: [],
}
