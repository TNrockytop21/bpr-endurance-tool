import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const ROUTES = ['/', '/fuel', '/stints', '/standings', '/grid', '/compare', '/coaching'];

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();
  const [showHelp, setShowHelp] = useState(false);

  const handleKey = useCallback(
    (e) => {
      // Don't fire when typing in inputs
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      switch (e.key) {
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
          navigate(ROUTES[parseInt(e.key) - 1]);
          break;
        case 't':
        case 'T':
          toggleTheme();
          break;
        case 'f':
        case 'F':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen?.();
            } else {
              document.exitFullscreen?.();
            }
          }
          break;
        case ' ':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('bpr:toggle-ghost'));
          break;
        case '?':
          setShowHelp((v) => !v);
          break;
        case 'Escape':
          setShowHelp(false);
          break;
      }
    },
    [navigate, toggleTheme]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return { showHelp, setShowHelp };
}
