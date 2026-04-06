import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTelemetryBuffers } from '../../context/TelemetryContext';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { formatLapTime } from '../../lib/utils';
import { ThrottleBrakeGauge } from './ThrottleBrakeGauge';
import { LiveTraceCanvas } from './LiveTraceCanvas';

export function DriverCard({ driver }) {
  const buffersRef = useTelemetryBuffers();
  const speedRef = useRef(null);
  const gearRef = useRef(null);
  const lapRef = useRef(null);
  const fuelRef = useRef(null);
  const lapTimeRef = useRef(null);

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driver.id);
    if (!buffer) return;
    const frame = buffer.getLatest();
    if (!frame) return;

    if (speedRef.current) speedRef.current.textContent = `${(frame.speed * 3.6).toFixed(0)}`;
    if (gearRef.current) gearRef.current.textContent = frame.gear > 0 ? frame.gear : 'N';
    if (lapRef.current) lapRef.current.textContent = `L${frame.lap}`;
    if (fuelRef.current) fuelRef.current.textContent = `${frame.fuel.toFixed(1)}L`;
    if (lapTimeRef.current) lapTimeRef.current.textContent = formatLapTime(frame.lapTime);
  });

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to={`/driver/${driver.id}`} className="hover:text-purple-400 transition-colors">
          <h3 className="font-semibold text-sm">{driver.name}</h3>
          <p className="text-xs text-muted">{driver.car}</p>
        </Link>
        <div className={`w-2 h-2 rounded-full ${driver.connected ? 'bg-throttle' : 'bg-muted'}`} />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs font-mono">
        <div className="flex items-baseline gap-1">
          <span ref={speedRef} className="text-lg font-bold">0</span>
          <span className="text-muted">km/h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted">G</span>
          <span ref={gearRef} className="text-base font-bold">N</span>
        </div>
        <span ref={lapRef} className="text-muted">L0</span>
        <span ref={fuelRef} className="text-muted">0.0L</span>
      </div>

      {/* Lap time */}
      <div className="text-center">
        <span ref={lapTimeRef} className="text-xl font-mono font-bold tracking-wider">
          --:--.---
        </span>
        {driver.bestLapTime && (
          <p className="text-xs text-purple-400 font-mono mt-0.5">
            Best: {formatLapTime(driver.bestLapTime)}
          </p>
        )}
      </div>

      {/* Gauges + Trace side by side */}
      <div className="flex gap-3">
        <div className="w-16 shrink-0">
          <ThrottleBrakeGauge driverId={driver.id} height={100} />
        </div>
        <div className="flex-1 min-w-0">
          <LiveTraceCanvas driverId={driver.id} height={100} />
        </div>
      </div>
    </div>
  );
}
