import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { wsClient } from '../lib/ws-client';

export function useStreamDeck() {
  const navigate = useNavigate();
  const { switchTeam, teams } = useSession();

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

        case 'switchTeam':
          if (payload.team) {
            switchTeam(payload.team);
          } else if (payload.direction && teams.length > 1) {
            const currentIdx = teams.indexOf(payload.currentTeam || teams[0]);
            const nextIdx = (currentIdx + (payload.direction > 0 ? 1 : -1) + teams.length) % teams.length;
            switchTeam(teams[nextIdx]);
          }
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
  }, [navigate, switchTeam, teams]);
}
