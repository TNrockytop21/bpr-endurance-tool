import { useRef, useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { useTelemetryBuffers } from '../../context/TelemetryContext';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { cn } from '../../lib/utils';

function getConfig() {
  try {
    return JSON.parse(localStorage.getItem('bpr_pit_config')) || {};
  } catch { return {}; }
}

function saveConfig(config) {
  localStorage.setItem('bpr_pit_config', JSON.stringify(config));
}

export function PitStopPlanner({ driverId }) {
  const { drivers } = useSession();
  const buffersRef = useTelemetryBuffers();
  const driver = drivers[driverId];

  const [showConfig, setShowConfig] = useState(false);
  const stored = getConfig();
  const [stintLimit, setStintLimit] = useState(stored.stintLimit || 45);
  const [tankCapacity, setTankCapacity] = useState(stored.tankCapacity || 100);

  const pitInRef = useRef(null);
  const factorRef = useRef(null);
  const fuelAddRef = useRef(null);
  const stintElapsedRef = useRef(null);
  const dotRef = useRef(null);

  const laps = driver?.laps?.filter((l) => l.valid && l.fuelUsed > 0) || [];
  const avgFuelPerLap = laps.length > 0
    ? laps.reduce((s, l) => s + l.fuelUsed, 0) / laps.length : null;
  const avgLapTime = laps.length > 0
    ? laps.reduce((s, l) => s + l.lapTime, 0) / laps.length : null;

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driverId);
    if (!buffer || !avgFuelPerLap || !avgLapTime) return;
    const frame = buffer.getLatest();
    if (!frame) return;

    const fuel = frame.fuel;
    const stintLimitSec = stintLimit * 60;

    // Fuel constraint
    const pitInFuel = Math.floor(fuel / avgFuelPerLap) - 1;

    // Stint time constraint (approximate from session time)
    const stintElapsed = frame.lapTime + (driver?.lapCount || 0) * avgLapTime;
    const pitInStint = Math.floor((stintLimitSec - stintElapsed) / avgLapTime);

    const pitIn = Math.max(0, Math.min(pitInFuel, pitInStint));
    const limiting = pitInFuel <= pitInStint ? 'FUEL' : 'TIME';

    // Fuel to add at pit
    const lapsToEnd = frame.sessionTimeRemain > 0 ? frame.sessionTimeRemain / avgLapTime : 0;
    const fuelAtPit = Math.max(0, fuel - (pitIn + 1) * avgFuelPerLap);
    const fuelNeeded = Math.min(lapsToEnd * avgFuelPerLap, tankCapacity);
    const fuelToAdd = Math.max(0, fuelNeeded - fuelAtPit);

    if (pitInRef.current) pitInRef.current.textContent = pitIn;
    if (factorRef.current) factorRef.current.textContent = limiting;
    if (fuelAddRef.current) fuelAddRef.current.textContent = `${fuelToAdd.toFixed(1)}L`;
    if (stintElapsedRef.current) {
      const mins = Math.floor(stintElapsed / 60);
      stintElapsedRef.current.textContent = `${mins}/${stintLimit}m`;
    }
    if (dotRef.current) {
      dotRef.current.className = cn(
        'w-3 h-3 rounded-full',
        pitIn > 5 ? 'bg-throttle' : pitIn > 1 ? 'bg-yellow-500' : 'bg-brake animate-pulse'
      );
    }
  });

  if (!driver || laps.length < 2) return null;

  return (
    <div className="bg-surface-raised border border-border rounded-lg px-4 py-2">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div ref={dotRef} className="w-3 h-3 rounded-full bg-muted" />
          <span className="text-xs text-muted uppercase">Pit in</span>
          <span ref={pitInRef} className="text-2xl font-bold font-mono">--</span>
          <span className="text-xs text-muted">laps</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">Limit:</span>
          <span ref={factorRef} className="text-xs font-mono font-semibold px-1.5 py-0.5 bg-surface-overlay rounded">--</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">Add:</span>
          <span ref={fuelAddRef} className="text-xs font-mono font-semibold">--</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">Stint:</span>
          <span ref={stintElapsedRef} className="text-xs font-mono">--</span>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="ml-auto text-muted hover:opacity-80 p-1"
          aria-label="Pit config"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>

      {showConfig && (
        <div className="mt-2 pt-2 border-t border-border flex gap-4 text-xs">
          <label className="flex items-center gap-1">
            <span className="text-muted">Stint limit (min):</span>
            <input
              type="number"
              value={stintLimit}
              onChange={(e) => {
                const v = Number(e.target.value);
                setStintLimit(v);
                saveConfig({ ...getConfig(), stintLimit: v });
              }}
              className="w-16 bg-surface-overlay border border-border rounded px-1.5 py-0.5"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-muted">Tank (L):</span>
            <input
              type="number"
              value={tankCapacity}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTankCapacity(v);
                saveConfig({ ...getConfig(), tankCapacity: v });
              }}
              className="w-16 bg-surface-overlay border border-border rounded px-1.5 py-0.5"
            />
          </label>
        </div>
      )}
    </div>
  );
}
