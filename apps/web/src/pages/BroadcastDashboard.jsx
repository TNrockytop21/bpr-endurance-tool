import { useSession } from '../context/SessionContext';
import { BroadcastStandings } from '../components/broadcast/BroadcastStandings';
import { BattleTracker } from '../components/broadcast/BattleTracker';
import { SessionTimer } from '../components/broadcast/SessionTimer';
import { IncidentFeed } from '../components/broadcast/IncidentFeed';
import { TelemetrySnippet } from '../components/broadcast/TelemetrySnippet';
import { TrackMap } from '../components/track/TrackMap';

const styles = {
  dashboard: {
    height: 'calc(100vh - 42px)',
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gridTemplateRows: '1fr auto',
    gap: '6px',
    padding: '6px',
    overflow: 'hidden',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minHeight: 0,
  },
  standings: {
    flex: 1,
    minHeight: 0,
  },
  bottomBar: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr 280px',
    gap: '6px',
    height: '180px',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minHeight: 0,
  },
  trackMapWrap: {
    flexShrink: 0,
  },
  battles: {
    flex: 1,
    minHeight: 0,
  },
};

export function BroadcastDashboard() {
  const { connected } = useSession();

  return (
    <div style={styles.dashboard}>
      {/* Left column: Standings + bottom bar */}
      <div style={styles.leftCol}>
        <div style={styles.standings}>
          <BroadcastStandings />
        </div>
        <div style={styles.bottomBar}>
          <SessionTimer />
          <IncidentFeed />
          <TelemetrySnippet />
        </div>
      </div>

      {/* Right column: Track map + battles */}
      <div style={styles.rightCol}>
        <div style={styles.trackMapWrap}>
          <TrackMap />
        </div>
        <div style={styles.battles}>
          <BattleTracker />
        </div>
      </div>
    </div>
  );
}
