import { createContext, useContext, useEffect, useRef } from 'react';
import { wsClient } from '../lib/ws-client';
import { TelemetryBuffer } from '../lib/telemetry-buffer';

const TelemetryContext = createContext(null);

export function TelemetryProvider({ children }) {
  const buffersRef = useRef(new Map());

  useEffect(() => {
    const unsubFrame = wsClient.on('telemetry:frame', (payload) => {
      const { driverId, ...frame } = payload;
      if (!buffersRef.current.has(driverId)) {
        buffersRef.current.set(driverId, new TelemetryBuffer());
      }
      buffersRef.current.get(driverId).push(frame);
    });

    return () => {
      unsubFrame();
    };
  }, []);

  return (
    <TelemetryContext.Provider value={buffersRef}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetryBuffers() {
  return useContext(TelemetryContext);
}
