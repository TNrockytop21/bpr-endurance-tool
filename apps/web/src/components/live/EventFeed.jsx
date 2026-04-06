import { useRef, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { formatLapTime } from '../../lib/utils';

const EVENT_CONFIG = {
  driver_joined: { color: 'bg-throttle', icon: '+' },
  driver_left: { color: 'bg-brake', icon: '-' },
  new_best_lap: { color: 'bg-purple-500', icon: '*' },
  stint_complete: { color: 'bg-yellow-500', icon: 'S' },
  pit_stop: { color: 'bg-blue-500', icon: 'P' },
};

function formatRelativeTime(timestamp) {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function eventDescription(event) {
  const d = event.data || {};
  switch (event.type) {
    case 'driver_joined':
      return `${d.driverName || 'Driver'} connected`;
    case 'driver_left':
      return `${d.driverName || 'Driver'} disconnected`;
    case 'new_best_lap':
      return `${d.driverName} set best lap ${formatLapTime(d.lapTime)} (L${d.lapNumber})`;
    case 'stint_complete':
      return `${d.driverName} stint: ${d.lapCount} laps, avg ${d.avgLapTime ? formatLapTime(d.avgLapTime) : '--'}`;
    default:
      return event.type;
  }
}

export function EventFeed() {
  const { events } = useSession();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  if (events.length === 0) return null;

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-muted mb-2">Race Log</h3>
      <div className="max-h-36 overflow-y-auto space-y-1 text-xs">
        {events.map((event, i) => {
          const config = EVENT_CONFIG[event.type] || { color: 'bg-muted', icon: '?' };
          return (
            <div key={event.id || i} className="flex items-center gap-2 py-0.5">
              <div className={`w-4 h-4 rounded-full ${config.color} flex items-center justify-center text-[9px] text-white font-bold shrink-0`}>
                {config.icon}
              </div>
              <span className="flex-1 min-w-0 truncate">{eventDescription(event)}</span>
              <span className="text-muted shrink-0">{formatRelativeTime(event.timestamp)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
