import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../../context/SessionContext';
import { wsClient } from '../../lib/ws-client';
import { formatLapTime } from '../../lib/utils';
import { LapSelector } from '../history/LapSelector';
import { LapComparisonChart } from '../history/LapComparisonChart';

/**
 * Lap comparison panel. Used by both Endurance Live and BPR Driver Detail.
 *
 * Props:
 *  - activeDriverId: the primary driver to compare
 *  - laps:           the primary driver's laps (when allowCrossDriver=false)
 *  - allowCrossDriver: when true, shows a driver dropdown for cross-driver
 *                     comparison (Endurance flow). When false, locks to the
 *                     active driver only (BPR detail flow).
 *  - onRequestLapList:  optional callback (driverId) => void
 *  - onRequestLapTrace: optional callback (driverId, lapNumber) => void
 *
 * Falls back to wsClient.send + session state when callbacks/laps not given.
 */
export function ComparisonSection({
  activeDriverId,
  laps: lapsProp,
  driverName: nameProp,
  allowCrossDriver = true,
  onRequestLapList,
  onRequestLapTrace,
}) {
  const { drivers } = useSession();
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedLaps, setSelectedLaps] = useState([]);
  const [traces, setTraces] = useState([]);

  const effectiveDriver = allowCrossDriver ? (selectedDriver || activeDriverId) : activeDriverId;

  // Resolve laps for the effective driver
  const resolvedLaps = (() => {
    if (effectiveDriver === activeDriverId && lapsProp) return lapsProp;
    return drivers[effectiveDriver]?.laps || [];
  })();

  const toggleLap = useCallback((lapNumber) => {
    setSelectedLaps((prev) =>
      prev.includes(lapNumber)
        ? prev.filter((n) => n !== lapNumber)
        : [...prev, lapNumber]
    );
  }, []);

  // Request lap list when effective driver changes
  useEffect(() => {
    if (!effectiveDriver) return;
    if (effectiveDriver === activeDriverId && onRequestLapList) {
      onRequestLapList();
    } else {
      wsClient.send('request:lapList', { driverId: effectiveDriver });
    }
  }, [effectiveDriver, activeDriverId, onRequestLapList]);

  // Request traces for selected laps
  useEffect(() => {
    if (!effectiveDriver) return;
    for (const lapNumber of selectedLaps) {
      if (effectiveDriver === activeDriverId && onRequestLapTrace) {
        onRequestLapTrace(lapNumber);
      } else {
        wsClient.send('request:lapTrace', { driverId: effectiveDriver, lapNumber });
      }
    }
  }, [effectiveDriver, activeDriverId, selectedLaps, onRequestLapTrace]);

  // Listen for trace responses
  useEffect(() => {
    const unsub = wsClient.on('lap:trace', (payload) => {
      const { driverId, lapNumber, trace } = payload;
      if (!trace) return;
      const name = drivers[driverId]?.name || (driverId === activeDriverId ? nameProp : driverId) || driverId;
      const lookupLaps = driverId === activeDriverId && lapsProp ? lapsProp : drivers[driverId]?.laps;
      const lap = lookupLaps?.find((l) => l.lapNumber === lapNumber);
      const timeStr = lap ? ` ${formatLapTime(lap.lapTime)}` : '';
      const label = `${name} L${lapNumber}${timeStr}`;

      setTraces((prev) => {
        const filtered = prev.filter((t) => !(t.driverId === driverId && t.lapNumber === lapNumber));
        return [...filtered, { label, driverId, lapNumber, trace }];
      });
    });
    return unsub;
  }, [drivers, activeDriverId, lapsProp, nameProp]);

  const activeTraces = traces.filter(
    (t) => t.driverId === effectiveDriver && selectedLaps.includes(t.lapNumber)
  );

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold uppercase">Lap Comparison</h3>
      <LapSelector
        selectedDriver={effectiveDriver}
        onSelectDriver={(id) => {
          if (!allowCrossDriver) return;
          setSelectedDriver(id);
          setSelectedLaps([]);
        }}
        selectedLaps={selectedLaps}
        onToggleLap={toggleLap}
        lapsOverride={effectiveDriver === activeDriverId ? resolvedLaps : undefined}
        hideDriverDropdown={!allowCrossDriver}
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
