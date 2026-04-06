import { useState, useRef, useMemo, useEffect } from 'react';
import { useSession } from '../context/SessionContext';
import { useTelemetryBuffers } from '../context/TelemetryContext';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { wsClient } from '../lib/ws-client';
import { cn } from '../lib/utils';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

// ── Helpers ──────────────────────────────────────────

function getConfig() {
  try { return JSON.parse(localStorage.getItem('bpr_pit_config')) || {}; }
  catch { return {}; }
}
function saveConfig(cfg) { localStorage.setItem('bpr_pit_config', JSON.stringify(cfg)); }

// ── Fuel Status Cards ────────────────────────────────

function FuelStatusCards({ driverId, laps }) {
  const buffersRef = useTelemetryBuffers();
  const fuelRef = useRef(null);
  const estRef = useRef(null);
  const marginRef = useRef(null);
  const marginDotRef = useRef(null);
  const timeRef = useRef(null);

  const validLaps = laps.filter((l) => l.valid && l.fuelUsed > 0);
  const avgFuel = validLaps.length > 0
    ? validLaps.reduce((s, l) => s + l.fuelUsed, 0) / validLaps.length : null;
  const avgLapTime = validLaps.length > 0
    ? validLaps.reduce((s, l) => s + l.lapTime, 0) / validLaps.length : null;

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driverId);
    if (!buffer) return;
    const frame = buffer.getLatest();
    if (!frame) return;

    if (fuelRef.current) fuelRef.current.textContent = frame.fuel.toFixed(1);
    if (avgFuel && avgFuel > 0) {
      const est = frame.fuel / avgFuel;
      if (estRef.current) estRef.current.textContent = est.toFixed(1);

      const lapsToEnd = avgLapTime > 0 && frame.sessionTimeRemain > 0
        ? frame.sessionTimeRemain / avgLapTime : 0;
      const margin = est - lapsToEnd;

      if (marginRef.current) {
        marginRef.current.textContent = margin > 0 ? `+${margin.toFixed(1)}` : margin.toFixed(1);
      }
      if (marginDotRef.current) {
        marginDotRef.current.className = cn(
          'w-2 h-2 rounded-full',
          margin > 3 ? 'bg-throttle' : margin > 0 ? 'bg-yellow-500' : 'bg-brake'
        );
      }
    }
    if (timeRef.current && frame.sessionTimeRemain > 0) {
      const h = Math.floor(frame.sessionTimeRemain / 3600);
      const m = Math.floor((frame.sessionTimeRemain % 3600) / 60);
      timeRef.current.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-surface-raised border border-border rounded-lg p-4 text-center">
        <p className="text-xs text-muted uppercase mb-1">Current Fuel</p>
        <p className="text-3xl font-bold font-mono">
          <span ref={fuelRef}>--</span>
          <span className="text-sm text-muted ml-1">L</span>
        </p>
      </div>
      <div className="bg-surface-raised border border-border rounded-lg p-4 text-center">
        <p className="text-xs text-muted uppercase mb-1">Avg / Lap</p>
        <p className="text-3xl font-bold font-mono">
          {avgFuel ? avgFuel.toFixed(2) : '--'}
          <span className="text-sm text-muted ml-1">L</span>
        </p>
      </div>
      <div className="bg-surface-raised border border-border rounded-lg p-4 text-center">
        <p className="text-xs text-muted uppercase mb-1">Est. Laps Left</p>
        <p ref={estRef} className="text-3xl font-bold font-mono">--</p>
      </div>
      <div className="bg-surface-raised border border-border rounded-lg p-4 text-center">
        <p className="text-xs text-muted uppercase mb-1">Margin</p>
        <div className="flex items-center justify-center gap-2">
          <div ref={marginDotRef} className="w-2 h-2 rounded-full bg-muted" />
          <p className="text-3xl font-bold font-mono">
            <span ref={marginRef}>--</span>
            <span className="text-sm text-muted ml-1">laps</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Pit Strategy Panel ───────────────────────────────

function PitStrategyPanel({ driverId, laps }) {
  const buffersRef = useTelemetryBuffers();
  const stored = getConfig();
  const [stintLimit, setStintLimit] = useState(stored.stintLimit || 45);
  const [tankCap, setTankCap] = useState(stored.tankCapacity || 100);
  const [pitDuration, setPitDuration] = useState(stored.pitDuration || 30);

  const pitInRef = useRef(null);
  const factorRef = useRef(null);
  const fuelAddRef = useRef(null);
  const stintRef = useRef(null);
  const dotRef = useRef(null);

  const validLaps = laps.filter((l) => l.valid && l.fuelUsed > 0);
  const avgFuel = validLaps.length > 0
    ? validLaps.reduce((s, l) => s + l.fuelUsed, 0) / validLaps.length : null;
  const avgLapTime = validLaps.length > 0
    ? validLaps.reduce((s, l) => s + l.lapTime, 0) / validLaps.length : null;

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driverId);
    if (!buffer || !avgFuel || !avgLapTime) return;
    const frame = buffer.getLatest();
    if (!frame) return;

    const fuel = frame.fuel;
    const stintLimitSec = stintLimit * 60;
    const pitInFuel = Math.floor(fuel / avgFuel) - 1;
    const stintElapsed = frame.lapTime + (laps.length * avgLapTime);
    const pitInStint = Math.floor((stintLimitSec - stintElapsed) / avgLapTime);
    const pitIn = Math.max(0, Math.min(pitInFuel, pitInStint));
    const limiting = pitInFuel <= pitInStint ? 'FUEL' : 'TIME';

    const lapsToEnd = frame.sessionTimeRemain > 0 ? frame.sessionTimeRemain / avgLapTime : 0;
    const fuelAtPit = Math.max(0, fuel - (pitIn + 1) * avgFuel);
    const fuelNeeded = Math.min(lapsToEnd * avgFuel, tankCap);
    const fuelToAdd = Math.max(0, fuelNeeded - fuelAtPit);

    if (pitInRef.current) pitInRef.current.textContent = pitIn;
    if (factorRef.current) factorRef.current.textContent = limiting;
    if (fuelAddRef.current) fuelAddRef.current.textContent = `${fuelToAdd.toFixed(1)}L`;
    if (stintRef.current) {
      const mins = Math.floor(stintElapsed / 60);
      stintRef.current.textContent = `${mins}/${stintLimit}m`;
    }
    if (dotRef.current) {
      dotRef.current.className = cn(
        'w-4 h-4 rounded-full',
        pitIn > 5 ? 'bg-throttle' : pitIn > 1 ? 'bg-yellow-500' : 'bg-brake animate-pulse'
      );
    }
  });

  function updateConfig(key, value) {
    const cfg = { ...getConfig(), [key]: value };
    saveConfig(cfg);
  }

  if (validLaps.length < 2) {
    return (
      <div className="bg-surface-raised border border-border rounded-lg p-6 text-center text-muted">
        Waiting for 2+ laps to calculate pit strategy...
      </div>
    );
  }

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold uppercase mb-4">Pit Strategy</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: live pit data */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div ref={dotRef} className="w-4 h-4 rounded-full bg-muted" />
            <div>
              <p className="text-xs text-muted uppercase">Pit In</p>
              <p className="text-4xl font-bold font-mono">
                <span ref={pitInRef}>--</span>
                <span className="text-lg text-muted ml-2">laps</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted">Limiting</p>
              <p ref={factorRef} className="font-mono font-semibold bg-surface-overlay rounded px-2 py-1 text-center">--</p>
            </div>
            <div>
              <p className="text-xs text-muted">Fuel to Add</p>
              <p ref={fuelAddRef} className="font-mono font-semibold text-center">--</p>
            </div>
            <div>
              <p className="text-xs text-muted">Stint</p>
              <p ref={stintRef} className="font-mono text-center">--</p>
            </div>
          </div>
        </div>

        {/* Right: settings */}
        <div className="space-y-3">
          <p className="text-xs text-muted uppercase font-semibold">Settings</p>
          <label className="flex items-center justify-between text-sm">
            <span className="text-muted">Stint limit</span>
            <div className="flex items-center gap-1">
              <input type="number" value={stintLimit}
                onChange={(e) => { setStintLimit(+e.target.value); updateConfig('stintLimit', +e.target.value); }}
                className="w-16 bg-surface-overlay border border-border rounded px-2 py-1 text-right font-mono" />
              <span className="text-muted text-xs">min</span>
            </div>
          </label>
          <label className="flex items-center justify-between text-sm">
            <span className="text-muted">Tank capacity</span>
            <div className="flex items-center gap-1">
              <input type="number" value={tankCap}
                onChange={(e) => { setTankCap(+e.target.value); updateConfig('tankCapacity', +e.target.value); }}
                className="w-16 bg-surface-overlay border border-border rounded px-2 py-1 text-right font-mono" />
              <span className="text-muted text-xs">L</span>
            </div>
          </label>
          <label className="flex items-center justify-between text-sm">
            <span className="text-muted">Pit stop duration</span>
            <div className="flex items-center gap-1">
              <input type="number" value={pitDuration}
                onChange={(e) => { setPitDuration(+e.target.value); updateConfig('pitDuration', +e.target.value); }}
                className="w-16 bg-surface-overlay border border-border rounded px-2 py-1 text-right font-mono" />
              <span className="text-muted text-xs">sec</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

// ── Fuel Consumption Chart ───────────────────────────

function FuelConsumptionChart({ laps, avgFuel }) {
  if (laps.length < 2) return null;

  // Build data: track fuel level at end of each lap
  let fuelLevel = laps[0].fuelUsed ? 40 : 40; // approximate starting fuel
  const data = [];
  let runningFuel = 40; // we don't have exact start, approximate
  for (const lap of laps) {
    runningFuel -= lap.fuelUsed || 0;
    data.push({ lap: lap.lapNumber, fuel: Math.max(0, runningFuel) });
  }

  // Projection
  if (avgFuel && avgFuel > 0 && data.length > 0) {
    const lastFuel = data[data.length - 1].fuel;
    const lastLap = data[data.length - 1].lap;
    const projLaps = Math.ceil(lastFuel / avgFuel);
    for (let i = 1; i <= Math.min(projLaps, 50); i++) {
      data.push({
        lap: lastLap + i,
        fuel: null,
        projected: Math.max(0, lastFuel - i * avgFuel),
      });
    }
  }

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-muted mb-2">Fuel Level Over Laps</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-canvas-grid)" />
          <XAxis dataKey="lap" stroke="var(--color-muted)" tick={{ fontSize: 10 }} />
          <YAxis stroke="var(--color-muted)" tick={{ fontSize: 10 }} unit="L" />
          <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface-overlay)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Empty', fill: '#ef4444', fontSize: 10 }} />
          <Line type="monotone" dataKey="fuel" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} name="Actual" />
          <Line type="monotone" dataKey="projected" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="6 4" dot={false} isAnimationActive={false} name="Projected" />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Fuel Per Lap Chart ───────────────────────────────

function FuelPerLapChart({ laps, avgFuel }) {
  const validLaps = laps.filter((l) => l.fuelUsed > 0);
  if (validLaps.length < 2) return null;

  const data = validLaps.map((l) => ({
    lap: l.lapNumber,
    fuel: l.fuelUsed,
    color: avgFuel ? (l.fuelUsed > avgFuel * 1.1 ? '#ef4444' : l.fuelUsed < avgFuel * 0.9 ? '#22c55e' : '#8b5cf6') : '#8b5cf6',
  }));

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-muted mb-2">Fuel Per Lap</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-canvas-grid)" />
          <XAxis dataKey="lap" stroke="var(--color-muted)" tick={{ fontSize: 10 }} />
          <YAxis stroke="var(--color-muted)" tick={{ fontSize: 10 }} unit="L" />
          <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface-overlay)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12 }} />
          {avgFuel && <ReferenceLine y={avgFuel} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `Avg: ${avgFuel.toFixed(3)}L`, fill: '#f59e0b', fontSize: 10, position: 'right' }} />}
          <Bar dataKey="fuel" isAnimationActive={false} name="Fuel Used">
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── What-If Calculator ───────────────────────────────

function WhatIfCalculator({ laps, driverId }) {
  const buffersRef = useTelemetryBuffers();
  const [savePercent, setSavePercent] = useState(0);
  const stored = getConfig();
  const pitDuration = stored.pitDuration || 30;
  const tankCap = stored.tankCapacity || 100;

  const fuelRef = useRef(null);
  const timeRemRef = useRef(null);
  const [liveFuel, setLiveFuel] = useState(40);
  const [lapsToEnd, setLapsToEnd] = useState(0);

  const validLaps = laps.filter((l) => l.valid && l.fuelUsed > 0);
  const avgFuel = validLaps.length > 0
    ? validLaps.reduce((s, l) => s + l.fuelUsed, 0) / validLaps.length : null;
  const avgLapTime = validLaps.length > 0
    ? validLaps.reduce((s, l) => s + l.lapTime, 0) / validLaps.length : null;

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driverId);
    if (!buffer) return;
    const frame = buffer.getLatest();
    if (!frame) return;
    setLiveFuel(frame.fuel);
    if (avgLapTime > 0 && frame.sessionTimeRemain > 0) {
      setLapsToEnd(Math.ceil(frame.sessionTimeRemain / avgLapTime));
    }
  });

  if (!avgFuel || validLaps.length < 2) {
    return (
      <div className="bg-surface-raised border border-border rounded-lg p-6 text-center text-muted">
        Waiting for lap data to calculate scenarios...
      </div>
    );
  }

  const scenarios = [0, 5, 10, 15, 20].map((pct) => {
    const savedFuel = avgFuel * (1 - pct / 100);
    const estLaps = liveFuel / savedFuel;
    const fuelNeeded = lapsToEnd * savedFuel;
    const deficit = fuelNeeded - liveFuel;
    const stops = deficit <= 0 ? 0 : Math.ceil(deficit / tankCap);
    return { pct, savedFuel, estLaps, fuelNeeded, deficit, stops };
  });

  // Pit stop strategies for current save %
  const currentSavedFuel = avgFuel * (1 - savePercent / 100);
  const totalFuelNeeded = lapsToEnd * currentSavedFuel;
  const pitStops = [];
  for (let stops = 0; stops <= 3; stops++) {
    const availableFuel = liveFuel + stops * tankCap;
    const canFinish = availableFuel >= totalFuelNeeded;
    const timeCost = stops * pitDuration;
    const fuelPerStop = stops > 0 ? Math.ceil((totalFuelNeeded - liveFuel) / stops) : 0;
    pitStops.push({ stops, canFinish, timeCost, fuelPerStop: Math.min(fuelPerStop, tankCap) });
  }

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold uppercase">What-If Fuel Saving</h3>

      {/* Slider */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted w-20">Fuel save:</span>
        <input
          type="range" min="0" max="20" step="1" value={savePercent}
          onChange={(e) => setSavePercent(+e.target.value)}
          className="flex-1 accent-purple-500"
        />
        <span className="text-sm font-mono font-semibold w-12 text-right">{savePercent}%</span>
      </div>

      {/* Scenario table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted uppercase border-b border-border">
              <th className="py-1.5 px-2 text-left">Save %</th>
              <th className="py-1.5 px-2 text-right">Fuel/Lap</th>
              <th className="py-1.5 px-2 text-right">Est. Laps</th>
              <th className="py-1.5 px-2 text-right">Fuel Needed</th>
              <th className="py-1.5 px-2 text-right">Deficit</th>
              <th className="py-1.5 px-2 text-right">Stops</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.pct} className={cn(
                'border-b border-border/30',
                s.pct === savePercent && 'bg-purple-500/10'
              )}>
                <td className="py-1.5 px-2 font-mono">{s.pct}%</td>
                <td className="py-1.5 px-2 text-right font-mono">{s.savedFuel.toFixed(3)}L</td>
                <td className="py-1.5 px-2 text-right font-mono">{s.estLaps.toFixed(0)}</td>
                <td className="py-1.5 px-2 text-right font-mono">{s.fuelNeeded.toFixed(1)}L</td>
                <td className={cn('py-1.5 px-2 text-right font-mono', s.deficit <= 0 ? 'text-throttle' : 'text-brake')}>
                  {s.deficit <= 0 ? `+${Math.abs(s.deficit).toFixed(1)}L` : `-${s.deficit.toFixed(1)}L`}
                </td>
                <td className="py-1.5 px-2 text-right font-mono">{s.stops}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pit stop scenarios */}
      <div>
        <h4 className="text-xs text-muted uppercase font-semibold mb-2">
          Pit Stop Scenarios ({savePercent}% save, {lapsToEnd} laps to go)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {pitStops.map((ps) => (
            <div key={ps.stops} className={cn(
              'border rounded-lg p-3 text-center text-sm',
              ps.canFinish ? 'border-throttle/30 bg-throttle/5' : 'border-border bg-surface-overlay/30'
            )}>
              <p className="font-bold text-lg">{ps.stops} stop{ps.stops !== 1 ? 's' : ''}</p>
              {ps.stops > 0 && (
                <>
                  <p className="text-xs text-muted">+{ps.timeCost}s pit time</p>
                  <p className="text-xs text-muted">{ps.fuelPerStop}L per stop</p>
                </>
              )}
              <p className={cn('text-xs font-semibold mt-1', ps.canFinish ? 'text-throttle' : 'text-brake')}>
                {ps.canFinish ? 'Can finish' : 'Not enough'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tire Data Panel ──────────────────────────────────

function tempColor(temp, low = 70, ideal = 85, high = 105) {
  if (temp < low) return 'text-blue-400';
  if (temp < ideal) return 'text-throttle';
  if (temp < high) return 'text-yellow-500';
  return 'text-brake';
}

function wearColor(wear) {
  if (wear > 0.7) return 'text-throttle';
  if (wear > 0.4) return 'text-yellow-500';
  return 'text-brake';
}

function brakeTempColor(temp) {
  if (temp < 200) return 'text-blue-400';
  if (temp < 500) return 'text-throttle';
  if (temp < 700) return 'text-yellow-500';
  return 'text-brake';
}

function TireDataPanel({ driverId }) {
  const buffersRef = useTelemetryBuffers();
  const refs = useRef({});

  const fields = [
    'tireLFtempL','tireLFtempM','tireLFtempR','tireRFtempL','tireRFtempM','tireRFtempR',
    'tireLRtempL','tireLRtempM','tireLRtempR','tireRRtempL','tireRRtempM','tireRRtempR',
    'tireLFwear','tireRFwear','tireLRwear','tireRRwear',
    'brakeLFtemp','brakeRFtemp','brakeLRtemp','brakeRRtemp',
  ];

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driverId);
    if (!buffer) return;
    const frame = buffer.getLatest();
    if (!frame) return;

    for (const f of fields) {
      const el = refs.current[f];
      if (!el || frame[f] === undefined) continue;
      const val = frame[f];

      if (f.includes('wear')) {
        el.textContent = `${(val * 100).toFixed(0)}%`;
        el.className = `font-mono text-sm font-semibold ${wearColor(val)}`;
      } else if (f.includes('brake')) {
        el.textContent = `${val.toFixed(0)}`;
        el.className = `font-mono text-sm font-semibold ${brakeTempColor(val)}`;
      } else {
        el.textContent = `${val.toFixed(0)}`;
        el.className = `font-mono text-sm font-semibold ${tempColor(val)}`;
      }
    }
  });

  function R(field) {
    return (el) => { if (el) refs.current[field] = el; };
  }

  function TireCorner({ label, prefix }) {
    return (
      <div className="bg-surface-overlay/30 rounded-lg p-3 text-center space-y-2">
        <p className="text-xs text-muted font-semibold uppercase">{label}</p>
        <div className="flex justify-center gap-2">
          <div>
            <p className="text-[10px] text-muted">Out</p>
            <p ref={R(`tire${prefix}tempL`)} className="font-mono text-sm">--</p>
          </div>
          <div>
            <p className="text-[10px] text-muted">Mid</p>
            <p ref={R(`tire${prefix}tempM`)} className="font-mono text-sm">--</p>
          </div>
          <div>
            <p className="text-[10px] text-muted">In</p>
            <p ref={R(`tire${prefix}tempR`)} className="font-mono text-sm">--</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-muted">Wear</p>
          <p ref={R(`tire${prefix}wear`)} className="font-mono text-sm">--%</p>
        </div>
        <div>
          <p className="text-[10px] text-muted">Brake</p>
          <p ref={R(`brake${prefix}temp`)} className="font-mono text-sm">--</p>
          <p className="text-[9px] text-muted">°C</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold uppercase mb-3">Tires & Brakes</h3>
      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
        <TireCorner label="Left Front" prefix="LF" />
        <TireCorner label="Right Front" prefix="RF" />
        <TireCorner label="Left Rear" prefix="LR" />
        <TireCorner label="Right Rear" prefix="RR" />
      </div>
      <p className="text-[10px] text-muted text-center mt-2">
        Temps in °C. Green = optimal, Yellow = hot, Red = overheating, Blue = cold
      </p>
    </div>
  );
}

// ── Engine Data Panel ────────────────────────────────

function EngineDataPanel({ driverId }) {
  const buffersRef = useTelemetryBuffers();
  const refs = useRef({});

  const gaugeFields = [
    { key: 'waterTemp', label: 'Water Temp', unit: '°C', warn: 100, crit: 110 },
    { key: 'oilTemp', label: 'Oil Temp', unit: '°C', warn: 120, crit: 140 },
    { key: 'oilPress', label: 'Oil Pressure', unit: 'bar', warnLow: 2, warn: 999, crit: 999 },
    { key: 'voltage', label: 'Voltage', unit: 'V', warnLow: 12, warn: 999, crit: 999 },
    { key: 'fuelPress', label: 'Fuel Pressure', unit: 'kPa', warnLow: 300, warn: 999, crit: 999 },
    { key: 'fuelUsePerHour', label: 'Fuel Use/hr', unit: 'L/h' },
    { key: 'rpm', label: 'RPM', unit: '' },
    { key: 'airTemp', label: 'Air Temp', unit: '°C' },
    { key: 'trackTemp', label: 'Track Temp', unit: '°C' },
    { key: 'incidents', label: 'Incidents', unit: 'x' },
    { key: 'lapDeltaToBest', label: 'Delta to Best', unit: 's' },
  ];

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driverId);
    if (!buffer) return;
    const frame = buffer.getLatest();
    if (!frame) return;

    for (const g of gaugeFields) {
      const el = refs.current[g.key];
      if (!el || frame[g.key] === undefined) continue;
      const val = frame[g.key];

      let color = '';
      if (g.crit && val > g.crit) color = 'text-brake';
      else if (g.warn && val > g.warn) color = 'text-yellow-500';
      else if (g.warnLow && val < g.warnLow) color = 'text-brake';
      else color = '';

      if (g.key === 'lapDeltaToBest') {
        el.textContent = `${val > 0 ? '+' : ''}${val.toFixed(3)}`;
        el.className = `font-mono text-lg font-bold ${val > 0 ? 'text-brake' : 'text-throttle'}`;
      } else if (g.key === 'incidents') {
        el.textContent = val;
        el.className = `font-mono text-lg font-bold ${val > 0 ? 'text-yellow-500' : ''}`;
      } else {
        el.textContent = Number.isInteger(val) ? val : val.toFixed(1);
        el.className = `font-mono text-lg font-bold ${color}`;
      }
    }
  });

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold uppercase mb-3">Engine & Environment</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {gaugeFields.map((g) => (
          <div key={g.key} className="bg-surface-overlay/30 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted uppercase mb-1">{g.label}</p>
            <p ref={(el) => { if (el) refs.current[g.key] = el; }} className="font-mono text-lg font-bold">
              --
            </p>
            <p className="text-[10px] text-muted">{g.unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Fuel Page ───────────────────────────────────

export function FuelPage() {
  const { activeDriverId, drivers } = useSession();
  const driver = activeDriverId ? drivers[activeDriverId] : null;
  const laps = driver?.laps || [];

  // Request lap list on mount / driver change
  useEffect(() => {
    if (activeDriverId) {
      wsClient.send('request:lapList', { driverId: activeDriverId });
    }
  }, [activeDriverId]);

  const validLaps = laps.filter((l) => l.valid && l.fuelUsed > 0);
  const avgFuel = validLaps.length > 0
    ? validLaps.reduce((s, l) => s + l.fuelUsed, 0) / validLaps.length : null;

  if (!driver) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted">
        <div className="text-center space-y-2">
          <p className="text-xl">No driver connected</p>
          <p className="text-sm">Connect a driver to see fuel strategy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <h2 className="text-lg font-bold">Fuel Strategy - {driver.name}</h2>

      <FuelStatusCards driverId={activeDriverId} laps={laps} />
      <PitStrategyPanel driverId={activeDriverId} laps={laps} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FuelConsumptionChart laps={laps} avgFuel={avgFuel} />
        <FuelPerLapChart laps={laps} avgFuel={avgFuel} />
      </div>

      <WhatIfCalculator laps={laps} driverId={activeDriverId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TireDataPanel driverId={activeDriverId} />
        <EngineDataPanel driverId={activeDriverId} />
      </div>
    </div>
  );
}
