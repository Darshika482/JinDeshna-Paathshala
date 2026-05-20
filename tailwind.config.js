/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0f7f2',
          100: '#dcede1',
          200: '#b9dac3',
          300: '#8ec09f',
          400: '#60a07a',
          500: '#3d8059',
          600: '#2d6645',
          700: '#1a3d2b',
          800: '#162e21',
          900: '#0e1f16',
        },
        saffron: {
          50: '#fef6ee',
          100: '#fdebd7',
          200: '#fad3ad',
          300: '#f6b279',
          400: '#f18742',
          500: '#E8660A',
          600: '#d95507',
          700: '#b34109',
          800: '#8f340f',
          900: '#752d10',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Devanagari', 'sans-serif'],
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
      }
    },
  },
  plugins: [],
}
