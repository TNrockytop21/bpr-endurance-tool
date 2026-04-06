import { useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { ThrottleBrakeGauge } from '../components/live/ThrottleBrakeGauge';
import { LiveTraceCanvas } from '../components/live/LiveTraceCanvas';
import { LapTable } from '../components/history/LapTable';

export function DriverDetailPage() {
  const { driverId } = useParams();
  const { drivers } = useSession();
  const driver = drivers[driverId];

  if (!driver) {
    return <div className="text-muted text-center mt-12">Driver not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold">{driver.name}</h2>
        <span className="text-muted text-sm">{driver.car}</span>
        <div className={`w-2 h-2 rounded-full ${driver.connected ? 'bg-throttle' : 'bg-muted'}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live gauges */}
        <div className="bg-surface-raised border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-muted mb-3">Live Input</h3>
          <ThrottleBrakeGauge driverId={driverId} height={200} />
        </div>

        {/* Live trace */}
        <div className="lg:col-span-2 bg-surface-raised border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-muted mb-3">Throttle & Brake Trace</h3>
          <LiveTraceCanvas driverId={driverId} height={200} />
        </div>
      </div>

      {/* Lap history */}
      <div className="bg-surface-raised border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-muted mb-3">Lap History</h3>
        <LapTable driverId={driverId} laps={driver.laps || []} bestLapTime={driver.bestLapTime} />
      </div>
    </div>
  );
}
