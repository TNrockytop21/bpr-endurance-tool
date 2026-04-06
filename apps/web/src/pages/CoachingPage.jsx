import { useState, useRef, useEffect } from 'react';
import { useSession } from '../context/SessionContext';
import { useTelemetryBuffers } from '../context/TelemetryContext';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { ThrottleBrakeGauge } from '../components/live/ThrottleBrakeGauge';
import { LiveTraceCanvas } from '../components/live/LiveTraceCanvas';
import { LapTable } from '../components/history/LapTable';
import { TrackMap } from '../components/track/TrackMap';
import { DriverComparisonPanel } from '../components/coaching/DriverComparisonPanel';
import { CornerAnalysis } from '../components/coaching/CornerAnalysis';
import { ConsistencyHeatmap } from '../components/track/ConsistencyHeatmap';
import { wsClient } from '../lib/ws-client';
import { computeSpeedVariance } from '../lib/trace-analysis';
import { formatLapTime } from '../lib/utils';

function DriverStats({ driverId }) {
  const buffersRef = useTelemetryBuffers();
  const speedRef = useRef(null);
  const gearRef = useRef(null);
  const lapRef = useRef(null);
  const lapTimeRef = useRef(null);
  const fuelRef = useRef(null);

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driverId);
    if (!buffer) return;
    const frame = buffer.getLatest();
    if (!frame) return;

    if (speedRef.current) speedRef.current.textContent = `${(frame.speed * 3.6).toFixed(0)} km/h`;
    if (gearRef.current) gearRef.current.textContent = `G${frame.gear > 0 ? frame.gear : 'N'}`;
    if (lapRef.current) lapRef.current.textContent = `Lap ${frame.lap}`;
    if (lapTimeRef.current) lapTimeRef.current.textContent = formatLapTime(frame.lapTime);
    if (fuelRef.current) fuelRef.current.textContent = `${frame.fuel.toFixed(1)}L`;
  });

  return (
    <div className="flex items-center gap-4 text-sm font-mono">
      <span ref={speedRef} className="text-lg font-bold">-- km/h</span>
      <span ref={gearRef} className="text-muted">G-</span>
      <span ref={lapRef} className="text-muted">Lap -</span>
      <span ref={lapTimeRef} className="text-white">--:--.---</span>
      <span ref={fuelRef} className="text-muted">--L</span>
    </div>
  );
}

export function CoachingPage() {
  const { drivers } = useSession();
  const driverList = Object.values(drivers);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [varianceData, setVarianceData] = useState(null);

  const driver = selectedDriver ? drivers[selectedDriver] : null;

  // Load last 5 lap traces for consistency heatmap
  useEffect(() => {
    if (!selectedDriver || !driver) return;
    const validLaps = (driver.laps || []).filter((l) => l.valid).slice(-5);
    if (validLaps.length < 2) { setVarianceData(null); return; }
    for (const lap of validLaps) {
      wsClient.send('request:lapTrace', { driverId: selectedDriver, lapNumber: lap.lapNumber });
    }
    const traces = [];
    const unsub = wsClient.on('lap:trace', (payload) => {
      if (payload.driverId !== selectedDriver || !payload.trace) return;
      traces.push(payload.trace);
      if (traces.length >= validLaps.length) {
        setVarianceData(computeSpeedVariance(traces));
      }
    });
    return unsub;
  }, [selectedDriver, driver?.laps?.length]);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Driver list sidebar + track map */}
      <div className="w-full lg:w-56 shrink-0 space-y-4 overflow-auto">
        <TrackMap width={210} height={160} />
        {varianceData && <ConsistencyHeatmap varianceData={varianceData} width={210} height={160} />}
        <div className="bg-surface-raised border border-border rounded-lg p-3 space-y-2">
        <h3 className="text-xs text-muted uppercase font-semibold mb-2">Drivers</h3>
        {driverList.length === 0 && (
          <p className="text-xs text-muted">No drivers connected</p>
        )}
        {driverList.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelectedDriver(d.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              selectedDriver === d.id
                ? 'bg-surface-overlay text-white border border-purple-500/50'
                : 'text-muted hover:text-white hover:bg-surface-overlay/50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${d.connected ? 'bg-throttle' : 'bg-muted'}`} />
              <span className="font-medium">{d.name}</span>
            </div>
            <div className="text-xs text-muted mt-0.5">{d.car}</div>
            {d.bestLapTime && (
              <div className="text-xs text-purple-400 font-mono mt-0.5">
                Best: {formatLapTime(d.bestLapTime)}
              </div>
            )}
          </button>
        ))}
        </div>
      </div>

      {/* Main coaching area */}
      <div className="flex-1 min-w-0 space-y-4 overflow-auto">
        {!driver ? (
          <div className="flex items-center justify-center h-full text-muted">
            Select a driver to monitor
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{driver.name}</h2>
                <p className="text-sm text-muted">{driver.car}</p>
              </div>
              <DriverStats driverId={selectedDriver} />
            </div>

            {/* Large trace + gauge */}
            <div className="grid grid-cols-[100px_1fr] gap-4">
              <div className="bg-surface-raised border border-border rounded-lg p-3">
                <ThrottleBrakeGauge driverId={selectedDriver} height={250} />
              </div>
              <div className="bg-surface-raised border border-border rounded-lg p-3">
                <LiveTraceCanvas driverId={selectedDriver} height={250} />
              </div>
            </div>

            {/* Lap table */}
            <div className="bg-surface-raised border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-muted mb-2">Lap History</h3>
              <LapTable
                driverId={selectedDriver}
                laps={driver.laps || []}
                bestLapTime={driver.bestLapTime}
              />
            </div>

            {/* Corner analysis */}
            <CornerAnalysis driverId={selectedDriver} />

            {/* Cross-driver comparison */}
            <DriverComparisonPanel />
          </>
        )}
      </div>
    </div>
  );
}
