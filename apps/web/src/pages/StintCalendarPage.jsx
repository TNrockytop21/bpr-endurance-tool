import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from '../context/SessionContext';
import { wsClient } from '../lib/ws-client';
import { cn, formatLapTime } from '../lib/utils';

// ── Persistence ──────────────────────────────────────

function loadPitConfig() {
  try { return JSON.parse(localStorage.getItem('bpr_pit_config')) || {}; } catch { return {}; }
}

const RACE_PRESETS = [
  { label: '1 Hour', minutes: 60 },
  { label: '2.4 Hours', minutes: 144 },
  { label: '3 Hours', minutes: 180 },
  { label: '6 Hours', minutes: 360 },
  { label: '12 Hours', minutes: 720 },
  { label: '24 Hours', minutes: 1440 },
];

const DRIVER_COLORS = [
  '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6',
];

function formatMin(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

function formatClockTime(raceStartTime, raceMinute) {
  if (!raceStartTime) return formatMin(raceMinute);
  const date = new Date(new Date(raceStartTime).getTime() + raceMinute * 60000);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ── Default plan ─────────────────────────────────────

function createDefaultPlan() {
  const pitCfg = loadPitConfig();
  return {
    raceLength: 360,
    raceStartTime: '',
    drivers: [],
    estimatedLapTime: 90,
    estimatedFuelPerLap: 2.5,
    tankCapacity: pitCfg.tankCapacity || 100,
    stints: [],
  };
}

function calcStintDuration(plan) {
  if (!plan.estimatedFuelPerLap || plan.estimatedFuelPerLap <= 0) return 45;
  const lapsPerTank = plan.tankCapacity / plan.estimatedFuelPerLap;
  return (lapsPerTank * plan.estimatedLapTime) / 60; // minutes
}

function generateStints(plan) {
  const dur = calcStintDuration(plan);
  if (dur <= 0 || plan.drivers.length === 0) return [];
  const stints = [];
  let time = 0;
  let id = 1;
  while (time < plan.raceLength) {
    const driverIdx = (id - 1) % plan.drivers.length;
    const driver = plan.drivers[driverIdx];
    const end = Math.min(time + dur, plan.raceLength);
    stints.push({
      id,
      driver: driver.name,
      startMin: time,
      endMin: end,
      isDouble: false,
      note: '',
      status: 'planned',
    });
    time = end;
    id++;
  }
  return stints;
}

// ── Driver Availability Editor ───────────────────────

function AvailabilityEditor({ driver, raceLength, raceStartTime, onChange }) {
  const [editing, setEditing] = useState(false);
  const [startH, setStartH] = useState('');
  const [endH, setEndH] = useState('');

  const avail = driver.availability || [];
  const isAllRace = avail.length === 0;

  function addWindow() {
    if (!startH || !endH) return;
    const newAvail = [...avail, { startMin: Number(startH) * 60, endMin: Number(endH) * 60 }];
    onChange({ ...driver, availability: newAvail });
    setStartH('');
    setEndH('');
  }

  function removeWindow(idx) {
    onChange({ ...driver, availability: avail.filter((_, i) => i !== idx) });
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs text-muted hover:text-purple-400 underline">
        {isAllRace ? 'All race' : avail.map((a) => `${formatMin(a.startMin)}-${formatMin(a.endMin)}`).join(', ')}
      </button>
    );
  }

  return (
    <div className="space-y-1">
      {avail.map((a, i) => (
        <div key={i} className="flex items-center gap-1 text-xs">
          <span>{formatMin(a.startMin)} - {formatMin(a.endMin)}</span>
          <button onClick={() => removeWindow(i)} className="text-brake text-[10px]">x</button>
        </div>
      ))}
      <div className="flex items-center gap-1 text-xs">
        <span className="text-muted">from hr</span>
        <input type="number" value={startH} onChange={(e) => setStartH(e.target.value)}
          className="w-10 bg-surface-overlay border border-border rounded px-1 py-0.5 text-xs" placeholder="0" />
        <span className="text-muted">to hr</span>
        <input type="number" value={endH} onChange={(e) => setEndH(e.target.value)}
          className="w-10 bg-surface-overlay border border-border rounded px-1 py-0.5 text-xs" placeholder="6" />
        <button onClick={addWindow} className="text-throttle text-xs font-semibold">+</button>
        <button onClick={() => setEditing(false)} className="text-muted text-xs ml-1">done</button>
      </div>
      <button onClick={() => { onChange({ ...driver, availability: [] }); setEditing(false); }}
        className="text-[10px] text-muted hover:text-purple-400">Set available all race</button>
    </div>
  );
}

// ── Timeline Bar ─────────────────────────────────────

function StintTimeline({ stints, raceLength, raceStartTime, drivers, onSelectStint, selectedStintId }) {
  if (stints.length === 0) return null;

  const driverColorMap = {};
  drivers.forEach((d, i) => { driverColorMap[d.name] = DRIVER_COLORS[i % DRIVER_COLORS.length]; });

  // Time markers
  const hourMarkers = [];
  for (let h = 0; h <= raceLength / 60; h++) {
    hourMarkers.push(h * 60);
  }

  return (
    <div className="space-y-1">
      {/* Time axis */}
      <div className="relative h-4 text-[9px] text-muted font-mono">
        {hourMarkers.map((m) => (
          <span key={m} className="absolute" style={{ left: `${(m / raceLength) * 100}%` }}>
            {raceStartTime ? formatClockTime(raceStartTime, m) : formatMin(m)}
          </span>
        ))}
      </div>
      {/* Stint blocks */}
      <div className="relative h-14 rounded overflow-hidden bg-surface-overlay/30 border border-border">
        {stints.map((stint) => {
          const left = (stint.startMin / raceLength) * 100;
          const width = ((stint.endMin - stint.startMin) / raceLength) * 100;
          const color = driverColorMap[stint.driver] || '#6b7280';
          const isSelected = stint.id === selectedStintId;
          return (
            <button
              key={stint.id}
              onClick={() => onSelectStint(stint.id)}
              className={cn(
                'absolute inset-y-0 flex flex-col items-center justify-center text-[10px] text-white font-semibold overflow-hidden border-r border-surface transition-opacity',
                isSelected && 'ring-2 ring-white/50',
                stint.status === 'complete' && 'opacity-60',
                stint.status === 'current' && 'animate-pulse',
              )}
              style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }}
            >
              <span className="truncate px-0.5">{stint.driver}</span>
              <span className="text-[8px] opacity-70">
                {stint.isDouble ? '2x' : ''} {formatMin(stint.endMin - stint.startMin)}
              </span>
              {stint.isDouble && (
                <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-white/40" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Stint Table ──────────────────────────────────────

function StintTable({ stints, drivers, raceStartTime, plan, setPlan }) {
  const driverNames = drivers.map((d) => d.name);

  function updateStint(id, updates) {
    setPlan((p) => {
      const newStints = p.stints.map((s) => (s.id === id ? { ...s, ...updates } : s));
      const updated = { ...p, stints: newStints };
      savePlan(updated);
      return updated;
    });
  }

  function toggleDouble(id) {
    setPlan((p) => {
      const dur = calcStintDuration(p);
      const newStints = p.stints.map((s) => {
        if (s.id !== id) return s;
        const newDouble = !s.isDouble;
        const newEnd = s.startMin + (newDouble ? dur * 2 : dur);
        return { ...s, isDouble: newDouble, endMin: Math.min(newEnd, p.raceLength) };
      });
      // Recalculate subsequent stint start times
      for (let i = 1; i < newStints.length; i++) {
        newStints[i].startMin = newStints[i - 1].endMin;
        const thisDur = newStints[i].isDouble ? dur * 2 : dur;
        newStints[i].endMin = Math.min(newStints[i].startMin + thisDur, p.raceLength);
      }
      // Remove stints that start after race end
      const filtered = newStints.filter((s) => s.startMin < p.raceLength);
      const updated = { ...p, stints: filtered };
      savePlan(updated);
      return updated;
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted text-xs uppercase border-b border-border">
            <th className="py-2 px-2 text-left w-12">Stint</th>
            <th className="py-2 px-2 text-left">Driver</th>
            <th className="py-2 px-2 text-left">Clock In</th>
            <th className="py-2 px-2 text-left">Clock Out</th>
            <th className="py-2 px-2 text-left">Duration</th>
            <th className="py-2 px-2 text-center">Double</th>
            <th className="py-2 px-2 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {stints.map((stint) => {
            const dur = stint.endMin - stint.startMin;
            // Check availability
            const driverObj = drivers.find((d) => d.name === stint.driver);
            const avail = driverObj?.availability || [];
            const hasWarning = avail.length > 0 && !avail.some(
              (a) => stint.startMin >= a.startMin && stint.endMin <= a.endMin
            );

            return (
              <tr key={stint.id} className={cn(
                'border-b border-border/30',
                stint.status === 'complete' && 'opacity-50',
                stint.status === 'current' && 'bg-purple-500/10',
              )}>
                <td className="py-1.5 px-2 font-mono text-muted">{stint.id}</td>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-1">
                    {hasWarning && <span className="text-yellow-500 text-xs" title="Outside driver availability">!</span>}
                    <select
                      value={stint.driver}
                      onChange={(e) => updateStint(stint.id, { driver: e.target.value })}
                      className="bg-surface-overlay border border-border rounded px-1.5 py-0.5 text-sm"
                    >
                      {driverNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </td>
                <td className="py-1.5 px-2 font-mono text-xs">{formatClockTime(raceStartTime, stint.startMin)}</td>
                <td className="py-1.5 px-2 font-mono text-xs">{formatClockTime(raceStartTime, stint.endMin)}</td>
                <td className="py-1.5 px-2 font-mono text-xs">{formatMin(dur)}</td>
                <td className="py-1.5 px-2 text-center">
                  <input type="checkbox" checked={stint.isDouble} onChange={() => toggleDouble(stint.id)}
                    className="accent-purple-500" />
                </td>
                <td className="py-1.5 px-2">
                  <input
                    type="text" value={stint.note} placeholder="..."
                    onChange={(e) => updateStint(stint.id, { note: e.target.value })}
                    className="bg-transparent border-b border-border/30 text-xs w-full focus:border-purple-500 outline-none px-1 py-0.5"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────

export function StintCalendarPage() {
  const { stints: actualStints, activeDriverId, drivers: sessionDrivers, currentTeam, teams } = useSession();
  const [plan, setPlan] = useState(createDefaultPlan());
  const [mode, setMode] = useState('plan');
  const [selectedStintId, setSelectedStintId] = useState(null);
  const [newDriverName, setNewDriverName] = useState('');

  // Plan management state
  const [eventName, setEventName] = useState('');
  const [planTeam, setPlanTeam] = useState(currentTeam || 'Team A');
  const [savedPlans, setSavedPlans] = useState([]);
  const [selectedPlanKey, setSelectedPlanKey] = useState('');

  const stintDuration = useMemo(() => calcStintDuration(plan), [plan.tankCapacity, plan.estimatedFuelPerLap, plan.estimatedLapTime]);

  // Update planTeam when currentTeam changes
  useEffect(() => { if (currentTeam) setPlanTeam(currentTeam); }, [currentTeam]);

  // Request plan list on mount
  useEffect(() => {
    wsClient.send('plan:list', {});
  }, []);

  // Listen for plan list and plan data from server
  useEffect(() => {
    const unsubs = [
      wsClient.on('plan:listResponse', (payload) => {
        setSavedPlans(payload.plans || []);
      }),
      wsClient.on('plan:data', (payload) => {
        if (payload.plan) {
          setPlan(payload.plan);
          setEventName(payload.plan.eventName || '');
          setPlanTeam(payload.plan.teamName || planTeam);
        }
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  function handleSavePlan() {
    if (!eventName.trim()) return;
    wsClient.send('plan:save', { eventName: eventName.trim(), teamName: planTeam, plan });
  }

  function handleLoadPlan() {
    if (!selectedPlanKey) return;
    const [ev, tm] = selectedPlanKey.split('|||');
    wsClient.send('plan:load', { eventName: ev, teamName: tm });
  }

  function handleDeletePlan() {
    if (!selectedPlanKey) return;
    const [ev, tm] = selectedPlanKey.split('|||');
    wsClient.send('plan:delete', { eventName: ev, teamName: tm });
    setSelectedPlanKey('');
  }

  function handleNewPlan() {
    setPlan(createDefaultPlan());
    setEventName('');
    setSelectedPlanKey('');
  }

  // Filter saved plans by selected team
  const teamPlans = savedPlans.filter((p) => p.teamName === planTeam);

  // Get live data for "Use live data" button
  const activeDriver = activeDriverId ? sessionDrivers[activeDriverId] : null;
  const liveLaps = activeDriver?.laps?.filter((l) => l.valid && l.fuelUsed > 0) || [];
  const liveAvgFuel = liveLaps.length > 0 ? liveLaps.reduce((s, l) => s + l.fuelUsed, 0) / liveLaps.length : null;
  const liveAvgLapTime = liveLaps.length > 0 ? liveLaps.reduce((s, l) => s + l.lapTime, 0) / liveLaps.length : null;

  function updatePlan(updates) {
    setPlan((p) => ({ ...p, ...updates }));
  }

  function addDriver() {
    if (!newDriverName.trim() || plan.drivers.some((d) => d.name === newDriverName.trim())) return;
    const drivers = [...plan.drivers, { name: newDriverName.trim(), availability: [] }];
    const newPlan = { ...plan, drivers };
    newPlan.stints = generateStints(newPlan);
    setPlan(newPlan);
    setNewDriverName('');
  }

  function removeDriver(name) {
    const drivers = plan.drivers.filter((d) => d.name !== name);
    const newPlan = { ...plan, drivers };
    newPlan.stints = generateStints(newPlan);
    setPlan(newPlan);
  }

  function updateDriver(idx, updated) {
    const drivers = plan.drivers.map((d, i) => (i === idx ? updated : d));
    setPlan((p) => ({ ...p, drivers }));
  }

  function handleRaceLengthChange(minutes) {
    const newPlan = { ...plan, raceLength: minutes };
    newPlan.stints = generateStints(newPlan);
    setPlan(newPlan);
  }

  function regenerateStints() {
    setPlan((p) => ({ ...p, stints: generateStints(p) }));
  }

  function useLiveData() {
    if (liveAvgFuel && liveAvgLapTime) {
      const newPlan = { ...plan, estimatedFuelPerLap: liveAvgFuel, estimatedLapTime: liveAvgLapTime };
      newPlan.stints = generateStints(newPlan);
      setPlan(newPlan);
    }
  }

  // Summary
  const totalCoverage = plan.stints.reduce((s, st) => s + (st.endMin - st.startMin), 0);
  const driverTime = {};
  plan.stints.forEach((s) => {
    driverTime[s.driver] = (driverTime[s.driver] || 0) + (s.endMin - s.startMin);
  });

  // Availability warnings
  const warnings = [];
  plan.stints.forEach((stint) => {
    const driverObj = plan.drivers.find((d) => d.name === stint.driver);
    const avail = driverObj?.availability || [];
    if (avail.length > 0 && !avail.some((a) => stint.startMin >= a.startMin && stint.endMin <= a.endMin)) {
      warnings.push(`${stint.driver} may be unavailable for Stint ${stint.id} (${formatClockTime(plan.raceStartTime, stint.startMin)} - ${formatClockTime(plan.raceStartTime, stint.endMin)})`);
    }
  });

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Stint Calendar</h2>
        <div className="flex gap-1">
          <button onClick={() => setMode('plan')}
            className={cn('px-3 py-1 rounded text-sm', mode === 'plan' ? 'bg-purple-500 text-white' : 'bg-surface-overlay text-muted')}>
            Plan
          </button>
          <button onClick={() => setMode('live')}
            className={cn('px-3 py-1 rounded text-sm', mode === 'live' ? 'bg-purple-500 text-white' : 'bg-surface-overlay text-muted')}>
            Live
          </button>
        </div>
      </div>

      {/* Plan Management */}
      <div className="bg-surface-raised border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold uppercase mb-3">Race Plans</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted block mb-1">Event Name</label>
            <input
              type="text" value={eventName} placeholder="e.g. Sebring 12hr"
              onChange={(e) => setEventName(e.target.value)}
              className="bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm w-48"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Team</label>
            <select value={planTeam} onChange={(e) => setPlanTeam(e.target.value)}
              className="bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm">
              {(teams.length > 0 ? teams : ['Team A', 'Team B', 'Team C']).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <button onClick={handleSavePlan} disabled={!eventName.trim()}
            className="px-3 py-1.5 bg-throttle text-white rounded text-sm font-semibold disabled:opacity-40">
            Save
          </button>
          <div className="border-l border-border pl-3 flex items-end gap-2">
            <div>
              <label className="text-xs text-muted block mb-1">Load Saved Plan</label>
              <select value={selectedPlanKey} onChange={(e) => setSelectedPlanKey(e.target.value)}
                className="bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm w-56">
                <option value="">Select a plan...</option>
                {teamPlans.map((p) => (
                  <option key={`${p.eventName}|||${p.teamName}`} value={`${p.eventName}|||${p.teamName}`}>
                    {p.eventName} ({p.driverCount} drivers)
                  </option>
                ))}
              </select>
            </div>
            <button onClick={handleLoadPlan} disabled={!selectedPlanKey}
              className="px-3 py-1.5 bg-purple-500 text-white rounded text-sm font-semibold disabled:opacity-40">
              Load
            </button>
            <button onClick={handleDeletePlan} disabled={!selectedPlanKey}
              className="px-3 py-1.5 bg-brake/80 text-white rounded text-sm font-semibold disabled:opacity-40">
              Delete
            </button>
            <button onClick={handleNewPlan}
              className="px-3 py-1.5 bg-surface-overlay border border-border text-muted rounded text-sm hover:text-white">
              New
            </button>
          </div>
        </div>
      </div>

      {/* Race Setup */}
      <div className="bg-surface-raised border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold uppercase mb-3">Race Setup</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-muted block mb-1">Race Length</label>
            <select
              value={RACE_PRESETS.find((p) => p.minutes === plan.raceLength) ? plan.raceLength : 'custom'}
              onChange={(e) => e.target.value !== 'custom' && handleRaceLengthChange(+e.target.value)}
              className="bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm"
            >
              {RACE_PRESETS.map((p) => <option key={p.minutes} value={p.minutes}>{p.label}</option>)}
              <option value="custom">Custom</option>
            </select>
          </div>
          {!RACE_PRESETS.find((p) => p.minutes === plan.raceLength) && (
            <div>
              <label className="text-xs text-muted block mb-1">Custom (minutes)</label>
              <input type="number" value={plan.raceLength}
                onChange={(e) => handleRaceLengthChange(+e.target.value)}
                className="w-20 bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm" />
            </div>
          )}
          <div>
            <label className="text-xs text-muted block mb-1">Race Start (local time)</label>
            <input type="datetime-local" value={plan.raceStartTime}
              onChange={(e) => updatePlan({ raceStartTime: e.target.value })}
              className="bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm" />
          </div>
        </div>
      </div>

      {/* Drivers & Availability */}
      <div className="bg-surface-raised border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold uppercase mb-3">Drivers & Availability</h3>
        <div className="space-y-2">
          {plan.drivers.map((driver, idx) => (
            <div key={driver.name} className="flex items-center gap-3 py-1">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: DRIVER_COLORS[idx % DRIVER_COLORS.length] }} />
              <span className="font-semibold text-sm w-28">{driver.name}</span>
              <AvailabilityEditor
                driver={driver}
                raceLength={plan.raceLength}
                raceStartTime={plan.raceStartTime}
                onChange={(updated) => updateDriver(idx, updated)}
              />
              <button onClick={() => removeDriver(driver.name)} className="text-xs text-brake ml-auto">Remove</button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <input
            type="text" value={newDriverName} placeholder="Driver name"
            onChange={(e) => setNewDriverName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDriver()}
            className="bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm flex-1 max-w-xs"
          />
          <button onClick={addDriver} className="px-3 py-1.5 bg-purple-500 text-white rounded text-sm font-semibold">
            + Add Driver
          </button>
        </div>
      </div>

      {/* Stint Settings */}
      <div className="bg-surface-raised border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold uppercase mb-3">Stint Settings</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-muted block mb-1">Lap Time (sec)</label>
            <input type="number" step="0.1" value={plan.estimatedLapTime}
              onChange={(e) => { updatePlan({ estimatedLapTime: +e.target.value }); }}
              className="w-20 bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Fuel/Lap (L)</label>
            <input type="number" step="0.01" value={plan.estimatedFuelPerLap}
              onChange={(e) => { updatePlan({ estimatedFuelPerLap: +e.target.value }); }}
              className="w-20 bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Tank (L)</label>
            <input type="number" value={plan.tankCapacity}
              onChange={(e) => { updatePlan({ tankCapacity: +e.target.value }); }}
              className="w-20 bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm font-mono" />
          </div>
          <div className="bg-surface-overlay rounded px-3 py-1.5 text-sm">
            <span className="text-muted">Est. Stint:</span>{' '}
            <span className="font-bold font-mono">{formatMin(stintDuration)}</span>
            <span className="text-muted text-xs ml-1">
              ({Math.floor(plan.tankCapacity / plan.estimatedFuelPerLap)} laps)
            </span>
          </div>
          {liveAvgFuel && (
            <button onClick={useLiveData}
              className="px-3 py-1.5 bg-throttle/20 text-throttle border border-throttle/30 rounded text-xs font-semibold">
              Use Live Data ({liveAvgFuel.toFixed(2)} L/lap, {formatLapTime(liveAvgLapTime)})
            </button>
          )}
          <button onClick={regenerateStints}
            className="px-3 py-1.5 bg-surface-overlay border border-border rounded text-xs text-muted hover:text-white">
            Regenerate Stints
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-surface-raised border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold uppercase mb-3">
          Stint Timeline {mode === 'live' ? '(Planned)' : ''}
        </h3>
        <StintTimeline
          stints={plan.stints}
          raceLength={plan.raceLength}
          raceStartTime={plan.raceStartTime}
          drivers={plan.drivers}
          onSelectStint={setSelectedStintId}
          selectedStintId={selectedStintId}
        />

        {/* Actual timeline in live mode */}
        {mode === 'live' && actualStints.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs text-muted uppercase mb-2">Actual</h4>
            <div className="relative h-10 rounded overflow-hidden bg-surface-overlay/30 border border-border">
              {actualStints.map((stint, i) => {
                const durMin = (stint.endTime - stint.startTime) / 60000;
                const startOffset = actualStints[0] ? (stint.startTime - actualStints[0].startTime) / 60000 : 0;
                const left = (startOffset / plan.raceLength) * 100;
                const width = (durMin / plan.raceLength) * 100;
                return (
                  <div
                    key={stint.id}
                    className="absolute inset-y-0 flex items-center justify-center text-[10px] text-white font-semibold border-r border-surface"
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 1)}%`,
                      backgroundColor: DRIVER_COLORS[i % DRIVER_COLORS.length],
                      opacity: 0.7,
                    }}
                  >
                    <span className="truncate px-0.5">{stint.driverName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Stint Table */}
      <div className="bg-surface-raised border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold uppercase mb-3">Stint Details</h3>
        <StintTable
          stints={plan.stints}
          drivers={plan.drivers}
          raceStartTime={plan.raceStartTime}
          plan={plan}
          setPlan={setPlan}
        />
      </div>

      {/* Summary */}
      <div className="bg-surface-raised border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold uppercase mb-3">Summary</h3>
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-muted">Total Stints:</span>{' '}
            <span className="font-bold">{plan.stints.length}</span>
          </div>
          <div>
            <span className="text-muted">Pit Stops:</span>{' '}
            <span className="font-bold">{Math.max(0, plan.stints.length - 1)}</span>
          </div>
          <div>
            <span className="text-muted">Coverage:</span>{' '}
            <span className={cn('font-bold', totalCoverage >= plan.raceLength ? 'text-throttle' : 'text-brake')}>
              {formatMin(totalCoverage)} / {formatMin(plan.raceLength)}
            </span>
          </div>
        </div>

        {/* Drive time per driver */}
        {Object.keys(driverTime).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {plan.drivers.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DRIVER_COLORS[i % DRIVER_COLORS.length] }} />
                <span>{d.name}:</span>
                <span className="font-mono font-semibold">{formatMin(driverTime[d.name] || 0)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mt-3 space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-500">! {w}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
