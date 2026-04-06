import { DriverGrid } from '../components/live/DriverGrid';
import { TrackMap } from '../components/track/TrackMap';

export function LivePage() {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="w-full md:w-auto md:shrink-0">
        <TrackMap width={280} height={200} />
      </div>
      <div className="flex-1 min-w-0">
        <DriverGrid />
      </div>
    </div>
  );
}
