/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      colors: {
        gold: {
          300: '#e8d5a3',
          400: '#d4af6e',
          500: '#c49a3c',
          600: '#a67c28',
        },
      },
    },
  },
  plugins: [],
};
