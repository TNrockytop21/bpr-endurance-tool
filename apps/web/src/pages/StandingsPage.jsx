import { useSession } from '../context/SessionContext';
import { formatLapTime, cn } from '../lib/utils';

function formatGap(val) {
  if (!val || val <= 0) return '-';
  if (val > 120) return `+${Math.floor(val / 120)}L`;
  return `+${val.toFixed(1)}`;
}

function formatSector(val) {
  if (!val || val <= 0) return '-';
  return val.toFixed(2);
}

export function StandingsPage() {
  const { standings, activeDriverId, drivers } = useSession();
  const activeDriver = activeDriverId ? drivers[activeDriverId] : null;
  const activeDriverName = activeDriver?.name;

  // Find overall best lap
  const bestLapOverall = standings.reduce((best, s) => {
    if (s.bestLap && (best === null || s.bestLap < best)) return s.bestLap;
    return best;
  }, null);

  if (standings.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted">
        <div className="text-center space-y-2">
          <p className="text-xl">No standings data</p>
          <p className="text-sm">Connect a driver agent to see live standings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-lg font-bold mb-4">Leaderboard</h2>

      <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border bg-surface-overlay/30">
                <th className="py-2.5 px-2 text-center w-10">Pos</th>
                <th className="py-2.5 px-2 text-center w-12">iR</th>
                <th className="py-2.5 px-2 text-left">Driver</th>
                <th className="py-2.5 px-3 text-right">Best</th>
                <th className="py-2.5 px-3 text-right">Last</th>
                <th className="py-2.5 px-2 text-right">S1</th>
                <th className="py-2.5 px-2 text-right">S2</th>
                <th className="py-2.5 px-2 text-right">S3</th>
                <th className="py-2.5 px-2 text-center w-10">Pit</th>
                <th className="py-2.5 px-2 text-center w-10">Lap</th>
                <th className="py-2.5 px-3 text-right">Int</th>
                <th className="py-2.5 px-3 text-right">Gap</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((entry, i) => {
                const isOurDriver = entry.name === activeDriverName;
                const hasBestOverall = entry.bestLap && entry.bestLap === bestLapOverall;

                return (
                  <tr
                    key={entry.pos}
                    className={cn(
                      'border-b border-border/30 transition-colors',
                      isOurDriver
                        ? 'bg-purple-500/15 border-l-2 border-l-purple-500'
                        : 'hover:bg-surface-overlay/20',
                    )}
                  >
                    {/* Position */}
                    <td className="py-2 px-2 text-center font-bold text-base">
                      {entry.pos}
                    </td>

                    {/* iRating */}
                    <td className="py-2 px-2 text-center">
                      <span className="text-[10px] text-muted font-mono">
                        {entry.iRating ? `${(entry.iRating / 1000).toFixed(1)}k` : '-'}
                      </span>
                    </td>

                    {/* Driver name */}
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        {entry.carNum && (
                          <span className="text-[10px] text-muted font-mono bg-surface-overlay rounded px-1">
                            #{entry.carNum}
                          </span>
                        )}
                        <span className={cn('font-medium', isOurDriver && 'text-purple-300')}>
                          {entry.name}
                        </span>
                      </div>
                    </td>

                    {/* Best lap */}
                    <td className={cn(
                      'py-2 px-3 text-right font-mono text-xs',
                      hasBestOverall ? 'text-purple-400 font-bold' : ''
                    )}>
                      {entry.bestLap ? formatLapTime(entry.bestLap) : '-'}
                    </td>

                    {/* Last lap */}
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {entry.lastLap ? formatLapTime(entry.lastLap) : '-'}
                    </td>

                    {/* Sectors */}
                    <td className="py-2 px-2 text-right font-mono text-xs text-muted">
                      {formatSector(entry.s1)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs text-muted">
                      {formatSector(entry.s2)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs text-muted">
                      {formatSector(entry.s3)}
                    </td>

                    {/* Pit */}
                    <td className="py-2 px-2 text-center">
                      {entry.onPitRoad ? (
                        <span className="inline-block w-5 h-5 rounded-full bg-brake/80 text-[10px] text-white leading-5 font-bold">P</span>
                      ) : (
                        <span className="inline-block w-5 h-5 rounded-full bg-throttle/60 text-[10px] text-white leading-5">S</span>
                      )}
                    </td>

                    {/* Laps */}
                    <td className="py-2 px-2 text-center font-mono text-xs">
                      {entry.lapsCompleted}
                    </td>

                    {/* Interval */}
                    <td className={cn(
                      'py-2 px-3 text-right font-mono text-xs',
                      i === 0 ? 'text-muted' : ''
                    )}>
                      {i === 0 ? '-' : formatGap(entry.interval)}
                    </td>

                    {/* Gap to leader */}
                    <td className={cn(
                      'py-2 px-3 text-right font-mono text-xs',
                      i === 0 ? 'text-muted' : ''
                    )}>
                      {i === 0 ? '0.0' : formatGap(entry.gap)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
