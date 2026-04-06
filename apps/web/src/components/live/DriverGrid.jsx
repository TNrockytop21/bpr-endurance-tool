import { useSession } from '../../context/SessionContext';
import { DriverCard } from './DriverCard';

export function DriverGrid() {
  const { drivers } = useSession();
  const driverList = Object.values(drivers);

  if (driverList.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        <div className="text-center">
          <p className="text-lg">Waiting for drivers...</p>
          <p className="text-sm mt-2">
            Start the Python agent on each driver's PC to connect
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {driverList.map((driver) => (
        <DriverCard key={driver.id} driver={driver} />
      ))}
    </div>
  );
}
