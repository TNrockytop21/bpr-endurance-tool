import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from '../context/SessionContext';
import { useTelemetryBuffers } from '../context/TelemetryContext';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { wsClient } from '../lib/ws-client';
import { formatLapTime } from '../lib/utils';
import { LiveTraceCanvas } from '../components/live/LiveTraceCanvas';
import { RecentLapsChart } from '../components/history/RecentLapsChart';
import { LapTimeTrendChart } from '../components/history/LapTimeTrendChart';
import { LapSelector } from '../components/history/LapSelector';
import { LapComparisonChart } from '../components/history/LapComparisonChart';
import { SectorTimesTable } from '../components/history/SectorTimesTable';
import { StintTimeline } from '../components/stint/StintTimeline';
import { EventFeed } from '../components/live/EventFeed';

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

function ComparisonSection({ activeDriverId }) {
  const { drivers } = useSession();
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedLaps, setSelectedLaps] = useState([]);
  const [traces, setTraces] = useState([]);

  const toggleLap = useCallback((lapNumber) => {
    setSelectedLaps((prev) =>
      prev.includes(lapNumber)
        ? prev.filter((n) => n !== lapNumber)
        : [...prev, lapNumber]
    );
  }, []);

  useEffect(() => {
    const driverId = selectedDriver || activeDriverId;
    if (driverId) wsClient.send('request:lapList', { driverId });
  }, [selectedDriver, activeDriverId]);

  useEffect(() => {
    const driverId = selectedDriver || activeDriverId;
    if (!driverId) return;
    for (const lapNumber of selectedLaps) {
      wsClient.send('request:lapTrace', { driverId, lapNumber });
    }
  }, [selectedDriver, activeDriverId, selectedLaps]);

  useEffect(() => {
    const unsub = wsClient.on('lap:trace', (payload) => {
      const { driverId, lapNumber, trace } = payload;
      if (!trace) return;
      const name = drivers[driverId]?.name || driverId;
      const lap = drivers[driverId]?.laps?.find((l) => l.lapNumber === lapNumber);
      const timeStr = lap ? ` ${formatLapTime(lap.lapTime)}` : '';
      const label = `${name} L${lapNumber}${timeStr}`;

      setTraces((prev) => {
        const filtered = prev.filter((t) => !(t.driverId === driverId && t.lapNumber === lapNumber));
        return [...filtered, { label, driverId, lapNumber, trace }];
      });
    });
    return unsub;
  }, [drivers]);

  const effectiveDriver = selectedDriver || activeDriverId;
  const activeTraces = traces.filter(
    (t) => t.driverId === effectiveDriver && selectedLaps.includes(t.lapNumber)
  );

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold uppercase">Lap Comparison</h3>
      <LapSelector
        selectedDriver={effectiveDriver}
        onSelectDriver={(id) => {
          setSelectedDriver(id);
          setSelectedLaps([]);
        }}
        selectedLaps={selectedLaps}
        onToggleLap={toggleLap}
      />
      {activeTraces.length > 0 ? (
        <div className="space-y-3">
          <LapComparisonChart traces={activeTraces} channel="throttle" title="Throttle" yDomain={[0, 1]} yFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
          <LapComparisonChart traces={activeTraces} channel="brake" title="Brake" yDomain={[0, 1]} yFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
          <LapComparisonChart traces={activeTraces} channel="speed" title="Speed (m/s)" showSpeedAnnotations />
        </div>
      ) : (
        <p className="text-muted text-sm text-center py-4">Select laps above to overlay and compare</p>
      )}
    </div>
  );
}

export function SingleDriverPage() {
  const { activeDriverId, drivers, profiles } = useSession();
  const driver = activeDriverId ? drivers[activeDriverId] : null;
  const [bestLapTrace, setBestLapTrace] = useState(null);
  const [ghostEnabled, setGhostEnabled] = useState(true);

  // Toggle ghost via Space key
  useEffect(() => {
    function onToggle() { setGhostEnabled((v) => !v); }
    window.addEventListener('bpr:toggle-ghost', onToggle);
    return () => window.removeEventListener('bpr:toggle-ghost', onToggle);
  }, []);

  // Fetch best lap trace for ghost line
  useEffect(() => {
    if (activeDriverId && driver?.bestLapNumber) {
      wsClient.send('request:lapTrace', {
        driverId: activeDriverId,
        lapNumber: driver.bestLapNumber,
      });
    }
  }, [activeDriverId, driver?.bestLapNumber]);

  useEffect(() => {
    if (!activeDriverId) return;
    const unsub = wsClient.on('lap:trace', (payload) => {
      if (
        payload.driverId === activeDriverId &&
        payload.lapNumber === driver?.bestLapNumber &&
        payload.trace
      ) {
        setBestLapTrace(payload.trace);
      }
    });
    return unsub;
  }, [activeDriverId, driver?.bestLapNumber]);

  // Ghost trace: session best > profile best > null
  const profileTrace = profiles[activeDriverId]?.bestLapTrace;
  const effectiveGhostTrace = ghostEnabled ? (bestLapTrace || profileTrace || null) : null;

  if (!driver) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-2xl font-black mx-auto">
            BPR
          </div>
          <div>
            <p className="text-xl font-semibold">BPR Endurance Tool</p>
            <p className="text-sm mt-1">Waiting for driver...</p>
            <p className="text-xs mt-3 opacity-60">Start the Python agent on the driver's PC to connect</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + live stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-throttle animate-pulse" />
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
        <ActiveDriverStats driverId={activeDriverId} />
      </div>

      {/* Gauges */}
      <HorizontalGauges driverId={activeDriverId} />

      {/* Live trace with ghost line */}
      <div className="bg-surface-raised border border-border rounded-lg p-4">
        <LiveTraceCanvas driverId={activeDriverId} height={200} ghostTrace={effectiveGhostTrace} />
      </div>

      {/* Recent laps */}
      <RecentLapsChart driverId={activeDriverId} />

      {/* Lap time trend + Sectors side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LapTimeTrendChart driverId={activeDriverId} />
        <SectorTimesTable driverId={activeDriverId} />
      </div>

      {/* Stint timeline + Event feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StintTimeline />
        <EventFeed />
      </div>

      {/* Lap comparison */}
      <ComparisonSection activeDriverId={activeDriverId} />
    </div>
  );
}
