import { useMemo } from 'react';
import { useSession } from '../context/SessionContext';
import { DriverCard } from '../components/live/OverviewDriverCard';

/**
 * Race Control Overview — shows a summary card for every connected driver.
 */
export function OverviewPage() {
  const { drivers } = useSession();

  const driverList = useMemo(() => {
    const list = Object.values(drivers || {});
    list.sort((a, b) => {
      if (a.connected !== b.connected) return a.connected ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    return list;
  }, [drivers]);

  const connectedCount = driverList.filter((d) => d.connected !== false).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">Race Control</h2>
          <p className="text-sm text-muted">All drivers currently on track</p>
        </div>
        <div className="text-sm font-mono text-muted">
          <span className="text-throttle font-semibold">{connectedCount}</span> connected
          {driverList.length > connectedCount && (
            <span className="ml-2 opacity-60">
              · {driverList.length - connectedCount} offline
            </span>
          )}
        </div>
      </div>

      {driverList.length === 0 ? (
        <div className="flex items-center justify-center h-[50vh] text-muted">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xl font-black mx-auto">
              BPR
            </div>
            <div>
              <p className="text-base font-semibold">Waiting for drivers...</p>
              <p className="text-xs mt-1 opacity-60">
                No drivers are currently connected
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {driverList.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      )}
    </div>
  );
}
