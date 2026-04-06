import { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { wsClient } from '../../lib/ws-client';
import { LapComparisonChart } from '../history/LapComparisonChart';
import { formatLapTime } from '../../lib/utils';

export function DriverComparisonPanel() {
  const { drivers } = useSession();
  const driverList = Object.values(drivers);

  const [driverA, setDriverA] = useState(null);
  const [driverB, setDriverB] = useState(null);
  const [lapA, setLapA] = useState(null);
  const [lapB, setLapB] = useState(null);
  const [traces, setTraces] = useState([]);

  // Request traces when selections change
  useEffect(() => {
    if (driverA && lapA) {
      wsClient.send('request:lapTrace', { driverId: driverA, lapNumber: lapA });
    }
    if (driverB && lapB) {
      wsClient.send('request:lapTrace', { driverId: driverB, lapNumber: lapB });
    }
  }, [driverA, lapA, driverB, lapB]);

  useEffect(() => {
    const unsub = wsClient.on('lap:trace', (payload) => {
      const { driverId, lapNumber, trace } = payload;
      if (!trace) return;
      const name = drivers[driverId]?.name || driverId;
      const label = `${name} L${lapNumber}`;
      setTraces((prev) => {
        const filtered = prev.filter((t) => !(t.driverId === driverId && t.lapNumber === lapNumber));
        return [...filtered, { label, driverId, lapNumber, trace }];
      });
    });
    return unsub;
  }, [drivers]);

  const activeTraces = traces.filter((t) => {
    if (t.driverId === driverA && t.lapNumber === lapA) return true;
    if (t.driverId === driverB && t.lapNumber === lapB) return true;
    return false;
  });

  const driverAData = driverA ? drivers[driverA] : null;
  const driverBData = driverB ? drivers[driverB] : null;

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white">Cross-Driver Comparison</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Driver A */}
        <div>
          <label className="text-xs text-muted uppercase mb-1 block">Driver A</label>
          <select
            value={driverA || ''}
            onChange={(e) => { setDriverA(e.target.value || null); setLapA(null); }}
            className="w-full bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm text-white mb-2"
          >
            <option value="">Select...</option>
            {driverList.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {driverAData?.laps?.length > 0 && (
            <select
              value={lapA || ''}
              onChange={(e) => setLapA(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm text-white"
            >
              <option value="">Best lap</option>
              {driverAData.laps.filter(l => l.valid).map((l) => (
                <option key={l.lapNumber} value={l.lapNumber}>
                  L{l.lapNumber} - {formatLapTime(l.lapTime)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Driver B */}
        <div>
          <label className="text-xs text-muted uppercase mb-1 block">Driver B</label>
          <select
            value={driverB || ''}
            onChange={(e) => { setDriverB(e.target.value || null); setLapB(null); }}
            className="w-full bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm text-white mb-2"
          >
            <option value="">Select...</option>
            {driverList.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {driverBData?.laps?.length > 0 && (
            <select
              value={lapB || ''}
              onChange={(e) => setLapB(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm text-white"
            >
              <option value="">Best lap</option>
              {driverBData.laps.filter(l => l.valid).map((l) => (
                <option key={l.lapNumber} value={l.lapNumber}>
                  L{l.lapNumber} - {formatLapTime(l.lapTime)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {activeTraces.length >= 2 && (
        <div className="space-y-3">
          <LapComparisonChart
            traces={activeTraces}
            channel="throttle"
            title="Throttle Comparison"
            yDomain={[0, 1]}
            yFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <LapComparisonChart
            traces={activeTraces}
            channel="brake"
            title="Brake Comparison"
            yDomain={[0, 1]}
            yFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <LapComparisonChart
            traces={activeTraces}
            channel="speed"
            title="Speed Comparison"
          />
        </div>
      )}

      {activeTraces.length < 2 && driverA && driverB && (
        <p className="text-xs text-muted text-center py-4">
          Select a lap for each driver to see the comparison
        </p>
      )}
    </div>
  );
}
