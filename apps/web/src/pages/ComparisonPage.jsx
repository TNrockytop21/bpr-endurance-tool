import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../context/SessionContext';
import { wsClient } from '../lib/ws-client';
import { LapSelector } from '../components/history/LapSelector';
import { LapComparisonChart } from '../components/history/LapComparisonChart';

export function ComparisonPage() {
  const { drivers } = useSession();

  // Primary driver selection
  const [primaryDriver, setPrimaryDriver] = useState(null);
  const [primaryLaps, setPrimaryLaps] = useState([]);

  // Secondary driver for cross-driver comparison
  const [secondaryDriver, setSecondaryDriver] = useState(null);
  const [secondaryLaps, setSecondaryLaps] = useState([]);

  // Loaded traces
  const [traces, setTraces] = useState([]);

  const toggleLap = useCallback((lapNumber, isPrimary) => {
    const setter = isPrimary ? setPrimaryLaps : setSecondaryLaps;
    setter((prev) =>
      prev.includes(lapNumber)
        ? prev.filter((n) => n !== lapNumber)
        : [...prev, lapNumber]
    );
  }, []);

  // Request lap traces when selection changes
  useEffect(() => {
    const allSelections = [
      ...primaryLaps.map((n) => ({ driverId: primaryDriver, lapNumber: n })),
      ...secondaryLaps.map((n) => ({ driverId: secondaryDriver, lapNumber: n })),
    ].filter((s) => s.driverId);

    // Request traces from server
    for (const sel of allSelections) {
      wsClient.send('request:lapTrace', sel);
    }
  }, [primaryDriver, primaryLaps, secondaryDriver, secondaryLaps]);

  // Listen for lap trace responses
  useEffect(() => {
    const unsub = wsClient.on('lap:trace', (payload) => {
      const { driverId, lapNumber, trace } = payload;
      if (!trace) return;
      const driverName = drivers[driverId]?.name || driverId;
      const label = `${driverName} L${lapNumber}`;

      setTraces((prev) => {
        const filtered = prev.filter((t) => t.label !== label);
        return [...filtered, { label, driverId, lapNumber, trace }];
      });
    });
    return unsub;
  }, [drivers]);

  // Filter traces to only show selected ones
  const selectedTraces = traces.filter((t) => {
    if (t.driverId === primaryDriver && primaryLaps.includes(t.lapNumber)) return true;
    if (t.driverId === secondaryDriver && secondaryLaps.includes(t.lapNumber)) return true;
    return false;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Lap Comparison</h2>

      {/* Primary driver */}
      <div className="bg-surface-raised border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-muted mb-3">Primary Driver</h3>
        <LapSelector
          selectedDriver={primaryDriver}
          onSelectDriver={(id) => {
            setPrimaryDriver(id);
            setPrimaryLaps([]);
          }}
          selectedLaps={primaryLaps}
          onToggleLap={(n) => toggleLap(n, true)}
        />
      </div>

      {/* Secondary driver for cross-comparison */}
      <div className="bg-surface-raised border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-muted mb-3">Compare Against (optional)</h3>
        <LapSelector
          selectedDriver={secondaryDriver}
          onSelectDriver={(id) => {
            setSecondaryDriver(id);
            setSecondaryLaps([]);
          }}
          selectedLaps={secondaryLaps}
          onToggleLap={(n) => toggleLap(n, false)}
        />
      </div>

      {/* Charts */}
      <LapComparisonChart
        traces={selectedTraces}
        channel="throttle"
        title="Throttle"
        yDomain={[0, 1]}
        yFormatter={(v) => `${(v * 100).toFixed(0)}%`}
      />
      <LapComparisonChart
        traces={selectedTraces}
        channel="brake"
        title="Brake"
        yDomain={[0, 1]}
        yFormatter={(v) => `${(v * 100).toFixed(0)}%`}
      />
      <LapComparisonChart
        traces={selectedTraces}
        channel="speed"
        title="Speed (m/s)"
      />
      <LapComparisonChart
        traces={selectedTraces}
        channel="gear"
        title="Gear"
        yDomain={[0, 7]}
      />
    </div>
  );
}
