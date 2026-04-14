import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { wsClient } from '../lib/ws-client';

export function useStreamDeck() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = wsClient.on('streamdeck:command', (payload) => {
      switch (payload.action) {
        case 'navigate':
          if (payload.page) navigate(payload.page);
          break;

        case 'zoom':
          window.dispatchEvent(
            new CustomEvent('bpr:zoom', {
              detail: { target: payload.target, ticks: payload.ticks || 0 },
            })
          );
          break;

        case 'scroll':
          window.scrollBy({
            top: (payload.ticks || 0) * -80,
            behavior: 'smooth',
          });
          break;

        case 'toggleGhost':
          window.dispatchEvent(new CustomEvent('bpr:toggle-ghost'));
          break;

        case 'fullscreen':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.();
          } else {
            document.exitFullscreen?.();
          }
          break;
      }
    });

    return unsub;
  }, [navigate]);
}
