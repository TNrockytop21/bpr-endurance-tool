import { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { wsClient } from '../../lib/ws-client';
import { LapComparisonChart } from './LapComparisonChart';
import { formatLapTime } from '../../lib/utils';

const MAX_RECENT = 3;

/**
 * Recent laps chart. Accepts laps as a prop OR falls back to reading from
 * session state for the active team. Accepts callbacks for requesting lap
 * list / traces, falling back to standard team-scoped requests.
 */
export function RecentLapsChart({
  driverId,
  laps: lapsProp,
  driverName: nameProp,
  onRequestLapList,
  onRequestLapTrace,
}) {
  const { drivers } = useSession();
  const sessionDriver = drivers[driverId];
  const laps = lapsProp ?? sessionDriver?.laps ?? [];
  const driverName = nameProp ?? sessionDriver?.name ?? driverId;
  const [traces, setTraces] = useState([]);

  // Request lap list on mount (for laps completed before viewer connected)
  useEffect(() => {
    if (!driverId) return;
    if (onRequestLapList) {
      onRequestLapList();
    } else {
      wsClient.send('request:lapList', { driverId });
    }
  }, [driverId, onRequestLapList]);

  // Request traces when laps are available or new ones complete
  useEffect(() => {
    const validLaps = laps.filter((l) => l.valid);
    const recent = validLaps.slice(-MAX_RECENT);

    for (const lap of recent) {
      if (onRequestLapTrace) {
        onRequestLapTrace(lap.lapNumber);
      } else {
        wsClient.send('request:lapTrace', { driverId, lapNumber: lap.lapNumber });
      }
    }
  }, [driverId, laps.length, onRequestLapTrace]);

  // Listen for trace responses (server replies on the same message type
  // for both team-scoped and BPR-scoped requests)
  useEffect(() => {
    const unsub = wsClient.on('lap:trace', (payload) => {
      if (payload.driverId !== driverId || !payload.trace) return;
      const lap = laps.find((l) => l.lapNumber === payload.lapNumber);
      const timeStr = lap ? formatLapTime(lap.lapTime) : '';
      const label = `L${payload.lapNumber} ${timeStr}`;

      setTraces((prev) => {
        const filtered = prev.filter((t) => t.lapNumber !== payload.lapNumber);
        const updated = [...filtered, { label, lapNumber: payload.lapNumber, trace: payload.trace }];
        // Keep only the most recent MAX_RECENT
        return updated.slice(-MAX_RECENT);
      });
    });
    return unsub;
  }, [driverId, laps]);

  // Reset traces when driver changes
  useEffect(() => {
    setTraces([]);
  }, [driverId]);

  const validLaps = laps.filter((l) => l.valid);
  if (validLaps.length === 0) {
    return (
      <div className="bg-surface-raised border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-muted mb-3 uppercase">Recent Laps</h3>
        <p className="text-muted text-sm text-center py-8">
          Waiting for completed laps...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <LapComparisonChart
        traces={traces}
        channel="throttle"
        title="Recent Laps - Throttle"
        yDomain={[0, 1]}
        yFormatter={(v) => `${(v * 100).toFixed(0)}%`}
      />
      <LapComparisonChart
        traces={traces}
        channel="brake"
        title="Recent Laps - Brake"
        yDomain={[0, 1]}
        yFormatter={(v) => `${(v * 100).toFixed(0)}%`}
      />
    </div>
  );
}
