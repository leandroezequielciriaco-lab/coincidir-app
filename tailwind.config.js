/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        coincidir: {
          cream: '#F8F5EF',
          ink: '#10231F',
          muted: '#6A746F',
          green: '#155C47',
          mint: '#DDF1E6',
          violet: '#7453D6',
          lavender: '#EFE8FF',
        },
      },
    },
  },
  plugins: [],
}
