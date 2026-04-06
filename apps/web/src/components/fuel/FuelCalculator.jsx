import { useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { useTelemetryBuffers } from '../../context/TelemetryContext';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';

export function FuelCalculator({ driverId }) {
  const { drivers } = useSession();
  const buffersRef = useTelemetryBuffers();
  const driver = drivers[driverId];

  const fuelRef = useRef(null);
  const estLapsRef = useRef(null);
  const statusRef = useRef(null);
  const statusDotRef = useRef(null);

  // Compute averages from completed laps
  const laps = driver?.laps?.filter((l) => l.valid && l.fuelUsed > 0) || [];
  const avgFuelPerLap = laps.length > 0
    ? laps.reduce((s, l) => s + l.fuelUsed, 0) / laps.length
    : null;
  const avgLapTime = laps.length > 0
    ? laps.reduce((s, l) => s + l.lapTime, 0) / laps.length
    : null;

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driverId);
    if (!buffer) return;
    const frame = buffer.getLatest();
    if (!frame) return;

    const fuel = frame.fuel;
    if (fuelRef.current) fuelRef.current.textContent = fuel.toFixed(1);

    if (avgFuelPerLap && avgFuelPerLap > 0) {
      const estLaps = fuel / avgFuelPerLap;
      if (estLapsRef.current) estLapsRef.current.textContent = estLaps.toFixed(1);

      // Can we finish?
      const lapsToFinish = avgLapTime > 0 && frame.sessionTimeRemain > 0
        ? frame.sessionTimeRemain / avgLapTime
        : null;

      if (statusRef.current && statusDotRef.current) {
        if (lapsToFinish !== null) {
          const margin = estLaps - lapsToFinish;
          if (margin > 1) {
            statusDotRef.current.className = 'w-2 h-2 rounded-full bg-throttle';
            statusRef.current.textContent = `+${margin.toFixed(1)} laps`;
          } else if (margin > 0) {
            statusDotRef.current.className = 'w-2 h-2 rounded-full bg-yellow-500';
            statusRef.current.textContent = `+${margin.toFixed(1)} laps (tight)`;
          } else {
            statusDotRef.current.className = 'w-2 h-2 rounded-full bg-brake';
            const deficit = Math.abs(margin) * avgFuelPerLap;
            statusRef.current.textContent = `Short ${deficit.toFixed(1)}L`;
          }
        } else {
          statusRef.current.textContent = `${estLaps.toFixed(0)} laps of fuel`;
          statusDotRef.current.className = 'w-2 h-2 rounded-full bg-muted';
        }
      }
    }
  });

  if (!driver) return null;

  return (
    <div className="bg-surface-raised border border-border rounded-lg px-4 py-2 flex items-center gap-6 text-sm">
      <div className="flex items-baseline gap-1.5">
        <span className="text-muted text-xs uppercase">Fuel</span>
        <span ref={fuelRef} className="text-lg font-bold font-mono">--</span>
        <span className="text-muted text-xs">L</span>
      </div>
      {avgFuelPerLap && (
        <div className="flex items-baseline gap-1.5">
          <span className="text-muted text-xs uppercase">Avg/Lap</span>
          <span className="font-mono">{avgFuelPerLap.toFixed(2)}</span>
          <span className="text-muted text-xs">L</span>
        </div>
      )}
      {avgFuelPerLap && (
        <div className="flex items-baseline gap-1.5">
          <span className="text-muted text-xs uppercase">Est. Laps</span>
          <span ref={estLapsRef} className="font-mono font-semibold">--</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 ml-auto">
        <div ref={statusDotRef} className="w-2 h-2 rounded-full bg-muted" />
        <span ref={statusRef} className="text-xs font-mono">
          {laps.length === 0 ? 'Calculating...' : ''}
        </span>
      </div>
    </div>
  );
}
