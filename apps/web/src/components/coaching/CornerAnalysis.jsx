import { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { wsClient } from '../../lib/ws-client';
import { detectCorners, cornerTimeLoss } from '../../lib/trace-analysis';
import { formatLapTime, cn } from '../../lib/utils';

export function CornerAnalysis({ driverId }) {
  const { drivers } = useSession();
  const driver = drivers[driverId];
  const [bestTrace, setBestTrace] = useState(null);
  const [compareTrace, setCompareTrace] = useState(null);
  const [compareLap, setCompareLap] = useState(null);

  // Fetch best lap trace
  useEffect(() => {
    if (driverId && driver?.bestLapNumber) {
      wsClient.send('request:lapTrace', { driverId, lapNumber: driver.bestLapNumber });
    }
  }, [driverId, driver?.bestLapNumber]);

  // Fetch compare lap trace
  useEffect(() => {
    if (driverId && compareLap) {
      wsClient.send('request:lapTrace', { driverId, lapNumber: compareLap });
    }
  }, [driverId, compareLap]);

  useEffect(() => {
    const unsub = wsClient.on('lap:trace', (payload) => {
      if (payload.driverId !== driverId || !payload.trace) return;
      if (payload.lapNumber === driver?.bestLapNumber) setBestTrace(payload.trace);
      if (payload.lapNumber === compareLap) setCompareTrace(payload.trace);
    });
    return unsub;
  }, [driverId, driver?.bestLapNumber, compareLap]);

  if (!driver || !bestTrace) return null;

  const corners = detectCorners(bestTrace);
  if (corners.length === 0) return null;

  const laps = (driver.laps || []).filter((l) => l.valid && l.lapNumber !== driver.bestLapNumber);
  const analysis = compareLap && compareTrace ? cornerTimeLoss(compareTrace, bestTrace, corners) : null;

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted">Corner Analysis</h3>
        <select
          value={compareLap || ''}
          onChange={(e) => {
            setCompareLap(e.target.value ? Number(e.target.value) : null);
            setCompareTrace(null);
          }}
          className="bg-surface-overlay border border-border rounded px-2 py-1 text-xs"
        >
          <option value="">Select lap to compare...</option>
          {laps.map((l) => (
            <option key={l.lapNumber} value={l.lapNumber}>
              L{l.lapNumber} {formatLapTime(l.lapTime)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted uppercase border-b border-border">
              <th className="py-1.5 px-2 text-left">Corner</th>
              <th className="py-1.5 px-2 text-right">Location</th>
              <th className="py-1.5 px-2 text-right">Min Speed</th>
              {analysis && <th className="py-1.5 px-2 text-right">Delta</th>}
            </tr>
          </thead>
          <tbody>
            {corners.map((c, i) => {
              const delta = analysis?.[i]?.delta;
              return (
                <tr key={c.number} className="border-b border-border/30">
                  <td className="py-1 px-2 font-mono">T{c.number}</td>
                  <td className="py-1 px-2 text-right text-muted font-mono">{c.pct}%</td>
                  <td className="py-1 px-2 text-right font-mono">{(c.minSpeed * 3.6).toFixed(0)} km/h</td>
                  {analysis && (
                    <td className={cn(
                      'py-1 px-2 text-right font-mono font-semibold',
                      delta > 0.1 ? 'text-brake' : delta < -0.1 ? 'text-throttle' : 'text-muted'
                    )}>
                      {delta > 0 ? '+' : ''}{delta?.toFixed(2)}%
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
