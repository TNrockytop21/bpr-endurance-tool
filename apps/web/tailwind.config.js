import path from 'path';

const webDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(webDir, 'index.html'),
    path.join(webDir, 'src', '**', '*.{js,jsx}'),
  ],
  theme: {
    extend: {
      colors: {
        throttle: '#22c55e',
        brake: '#ef4444',
        surface: {
          DEFAULT: '#0f1117',
          raised: '#1a1d27',
          overlay: '#252833',
        },
        border: '#2e3140',
        muted: '#6b7280',
      },
    },
  },
  plugins: [],
};
