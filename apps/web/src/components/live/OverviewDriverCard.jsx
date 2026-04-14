import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTelemetryBuffers } from '../../context/TelemetryContext';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { formatLapTime } from '../../lib/utils';

/**
 * Driver summary card for the overview grid.
 *
 * Props:
 *  - driver: { id, name, car, connected, bestLapTime, lapCount }
 */
export function DriverCard({ driver }) {
  const buffersRef = useTelemetryBuffers();
  const speedRef = useRef(null);
  const gearRef = useRef(null);
  const lapRef = useRef(null);
  const lapTimeRef = useRef(null);
  const throttleBarRef = useRef(null);
  const brakeBarRef = useRef(null);
  const throttleValRef = useRef(null);
  const brakeValRef = useRef(null);

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driver.id);
    if (!buffer) return;
    const frame = buffer.getLatest();
    if (!frame) return;

    if (speedRef.current) speedRef.current.textContent = (frame.speed * 3.6).toFixed(0);
    if (gearRef.current) gearRef.current.textContent = frame.gear > 0 ? frame.gear : 'N';
    if (lapRef.current) lapRef.current.textContent = `L${frame.lap}`;
    if (lapTimeRef.current) lapTimeRef.current.textContent = formatLapTime(frame.lapTime);

    const t = Math.round(frame.throttle * 100);
    const b = Math.round(frame.brake * 100);
    if (throttleBarRef.current) throttleBarRef.current.style.width = `${t}%`;
    if (brakeBarRef.current) brakeBarRef.current.style.width = `${b}%`;
    if (throttleValRef.current) throttleValRef.current.textContent = `${t}%`;
    if (brakeValRef.current) brakeValRef.current.textContent = `${b}%`;
  });

  const isConnected = driver.connected !== false;
  const detailUrl = `/driver/${encodeURIComponent(driver.id)}`;

  return (
    <Link
      to={detailUrl}
      className="bg-surface-raised border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-purple-500/60 transition-colors"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{driver.name}</h3>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-throttle' : 'bg-muted'}`} />
      </div>

      <p className="text-xs text-muted truncate">{driver.car}</p>

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
      </div>

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

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-throttle font-semibold w-7">THR</span>
          <div className="flex-1 bg-surface rounded-full h-2 overflow-hidden relative">
            <div
              ref={throttleBarRef}
              className="absolute inset-y-0 left-0 bg-throttle/70 rounded-full transition-[width] duration-[40ms]"
              style={{ width: '0%' }}
            />
          </div>
          <span ref={throttleValRef} className="text-[10px] text-throttle font-mono w-7 text-right">0%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-brake font-semibold w-7">BRK</span>
          <div className="flex-1 bg-surface rounded-full h-2 overflow-hidden relative">
            <div
              ref={brakeBarRef}
              className="absolute inset-y-0 left-0 bg-brake/70 rounded-full transition-[width] duration-[40ms]"
              style={{ width: '0%' }}
            />
          </div>
          <span ref={brakeValRef} className="text-[10px] text-brake font-mono w-7 text-right">0%</span>
        </div>
      </div>
    </Link>
  );
}
