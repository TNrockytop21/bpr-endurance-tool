const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src', '**', '*.{js,jsx}'),
  ],
  theme: {
    extend: {
      colors: {
        throttle: '#22c55e',
        brake: '#ef4444',
        surface: {
          DEFAULT: 'var(--color-surface)',
          raised: 'var(--color-surface-raised)',
          overlay: 'var(--color-surface-overlay)',
        },
        border: 'var(--color-border)',
        muted: 'var(--color-muted)',
      },
    },
  },
  plugins: [],
};
