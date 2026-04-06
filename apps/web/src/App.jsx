import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { SessionProvider } from './context/SessionContext';
import { TelemetryProvider } from './context/TelemetryContext';
import { wsClient } from './lib/ws-client';
import { router } from './routes';

export default function App() {
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/viewer`;
    wsClient.connect(wsUrl);
    return () => wsClient.disconnect();
  }, []);

  return (
    <ThemeProvider>
      <SessionProvider>
        <TelemetryProvider>
          <RouterProvider router={router} />
        </TelemetryProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
