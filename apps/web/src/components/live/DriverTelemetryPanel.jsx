import { useRef } from 'react';
import { useTelemetryBuffers } from '../../context/TelemetryContext';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { formatLapTime } from '../../lib/utils';
import { LiveTraceCanvas } from './LiveTraceCanvas';
import { RecentLapsChart } from '../history/RecentLapsChart';
import { LapTimeTrendChart } from '../history/LapTimeTrendChart';
import { SectorTimesTable } from '../history/SectorTimesTable';
import { StintTimeline } from '../stint/StintTimeline';
import { EventFeed } from './EventFeed';
import { ComparisonSection } from './ComparisonSection';

/**
 * Reusable telemetry panel rendered by both Endurance Live and BPR Driver Detail.
 *
 * Props:
 *  - driverId          (string)  globally unique driver id
 *  - driver            (object)  { name, car, connected, bestLapTime, bestLapNumber, bestSectors, laps }
 *  - ghostTrace        (array)   optional best-lap trace for ghost overlay
 *  - showStints        (bool)    render StintTimeline (default true)
 *  - showEventFeed     (bool)    render EventFeed (default true) — team-scoped
 *  - allowCrossDriver  (bool)    show cross-driver dropdown in ComparisonSection (default true)
 *  - onRequestLapList  (func)    optional callback to refresh lap list
 *  - onRequestLapTrace (func)    optional callback (lapNumber) => void
 */
export function DriverTelemetryPanel({
  driverId,
  driver,
  ghostTrace = null,
  showStints = true,
  showEventFeed = true,
  allowCrossDriver = true,
  onRequestLapList,
  onRequestLapTrace,
}) {
  if (!driver) return null;

  return (
    <div className="space-y-4">
      {/* Header + live stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${driver.connected !== false ? 'bg-throttle animate-pulse' : 'bg-muted'}`}
          />
          <div>
            <h2 className="text-xl font-bold">{driver.name}</h2>
            <p className="text-sm text-muted">{driver.car}</p>
          </div>
          {driver.bestLapTime && (
            <span className="text-sm text-purple-400 font-mono ml-4">
              Best: {formatLapTime(driver.bestLapTime)}
            </span>
          )}
        </div>
        <ActiveDriverStats driverId={driverId} />
      </div>

      {/* Gauges */}
      <HorizontalGauges driverId={driverId} />

      {/* Live trace with ghost line */}
      <div className="bg-surface-raised border border-border rounded-lg p-4">
        <LiveTraceCanvas driverId={driverId} height={200} ghostTrace={ghostTrace} />
      </div>

      {/* Recent laps */}
      <RecentLapsChart
        driverId={driverId}
        laps={driver.laps}
        driverName={driver.name}
        onRequestLapList={onRequestLapList}
        onRequestLapTrace={onRequestLapTrace}
      />

      {/* Lap time trend + Sectors side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LapTimeTrendChart
          driverId={driverId}
          laps={driver.laps}
          bestLapTime={driver.bestLapTime}
        />
        <SectorTimesTable
          driverId={driverId}
          laps={driver.laps}
          bestSectors={driver.bestSectors}
        />
      </div>

      {/* Stint timeline + Event feed */}
      {(showStints || showEventFeed) && (
        <div className={showStints && showEventFeed ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : ''}>
          {showStints && <StintTimeline />}
          {showEventFeed && <EventFeed />}
        </div>
      )}

      {/* Lap comparison */}
      <ComparisonSection
        activeDriverId={driverId}
        laps={driver.laps}
        driverName={driver.name}
        allowCrossDriver={allowCrossDriver}
        onRequestLapList={onRequestLapList}
        onRequestLapTrace={onRequestLapTrace}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers (extracted from SingleDriverPage)
// ---------------------------------------------------------------------------

function HorizontalGauges({ driverId }) {
  const buffersRef = useTelemetryBuffers();
  const throttleBarRef = useRef(null);
  const brakeBarRef = useRef(null);
  const throttleValRef = useRef(null);
  const brakeValRef = useRef(null);

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driverId);
    if (!buffer) return;
    const frame = buffer.getLatest();
    if (!frame) return;

    const t = Math.round(frame.throttle * 100);
    const b = Math.round(frame.brake * 100);

    if (throttleBarRef.current) throttleBarRef.current.style.width = `${t}%`;
    if (brakeBarRef.current) brakeBarRef.current.style.width = `${b}%`;
    if (throttleValRef.current) throttleValRef.current.textContent = `${t}%`;
    if (brakeValRef.current) brakeValRef.current.textContent = `${b}%`;
  });

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
      <div className="flex-1 flex items-center gap-2">
        <span className="text-xs text-throttle font-semibold w-8">THR</span>
        <div className="flex-1 bg-surface rounded-full h-5 overflow-hidden relative">
          <div
            ref={throttleBarRef}
            className="absolute inset-y-0 left-0 bg-throttle/70 rounded-full transition-[width] duration-[40ms]"
            style={{ width: '0%' }}
          />
        </div>
        <span ref={throttleValRef} className="text-xs text-throttle font-mono w-8 text-right">0%</span>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <span className="text-xs text-brake font-semibold w-8">BRK</span>
        <div className="flex-1 bg-surface rounded-full h-5 overflow-hidden relative">
          <div
            ref={brakeBarRef}
            className="absolute inset-y-0 left-0 bg-brake/70 rounded-full transition-[width] duration-[40ms]"
            style={{ width: '0%' }}
          />
        </div>
        <span ref={brakeValRef} className="text-xs text-brake font-mono w-8 text-right">0%</span>
      </div>
    </div>
  );
}

function ActiveDriverStats({ driverId }) {
  const buffersRef = useTelemetryBuffers();
  const speedRef = useRef(null);
  const gearRef = useRef(null);
  const lapRef = useRef(null);
  const lapTimeRef = useRef(null);

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driverId);
    if (!buffer) return;
    const frame = buffer.getLatest();
    if (!frame) return;

    if (speedRef.current) speedRef.current.textContent = (frame.speed * 3.6).toFixed(0);
    if (gearRef.current) gearRef.current.textContent = frame.gear > 0 ? frame.gear : 'N';
    if (lapRef.current) lapRef.current.textContent = frame.lap;
    if (lapTimeRef.current) lapTimeRef.current.textContent = formatLapTime(frame.lapTime);
  });

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-6 font-mono text-sm">
      <div className="flex items-baseline gap-1">
        <span ref={speedRef} className="text-2xl sm:text-3xl font-bold">--</span>
        <span className="text-muted text-xs">km/h</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-muted text-xs">G</span>
        <span ref={gearRef} className="text-xl sm:text-2xl font-bold">-</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-muted text-xs">Lap</span>
        <span ref={lapRef} className="text-lg font-semibold">-</span>
      </div>
      <span ref={lapTimeRef} className="text-xl sm:text-2xl font-bold tracking-wider">--:--.---</span>
    </div>
  );
}
