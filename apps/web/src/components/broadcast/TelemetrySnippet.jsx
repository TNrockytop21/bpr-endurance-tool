import { useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { useTelemetryBuffers } from '../../context/TelemetryContext';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { formatLapTime } from '../../lib/utils';

const styles = {
  container: {
    background: '#0d0d0f',
    border: '1px solid #1a1a1a',
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '100%',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #1a1a1a',
    fontSize: '9px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    fontWeight: 600,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    padding: '8px',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  card: {
    background: '#111',
    border: '1px solid #1a1a1a',
    borderRadius: '3px',
    padding: '8px 10px',
  },
  nameRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  name: {
    fontWeight: 600,
    fontSize: '12px',
    color: '#ccc',
  },
  speed: {
    fontSize: '16px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  barsWrap: {
    display: 'flex',
    gap: '6px',
  },
  barGroup: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  barLabel: {
    fontSize: '8px',
    fontWeight: 700,
    width: '20px',
    textTransform: 'uppercase',
  },
  barTrack: {
    flex: 1,
    height: '6px',
    background: '#1a1a1a',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 40ms',
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '4px',
    fontSize: '10px',
    color: '#666',
    fontVariantNumeric: 'tabular-nums',
  },
};

function DriverSnippet({ driver }) {
  const buffersRef = useTelemetryBuffers();
  const speedRef = useRef(null);
  const gearRef = useRef(null);
  const throttleRef = useRef(null);
  const brakeRef = useRef(null);
  const lapTimeRef = useRef(null);

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driver.id);
    if (!buffer) return;
    const frame = buffer.getLatest();
    if (!frame) return;

    if (speedRef.current) speedRef.current.textContent = `${(frame.speed * 3.6).toFixed(0)}`;
    if (gearRef.current) gearRef.current.textContent = frame.gear > 0 ? frame.gear : 'N';
    if (lapTimeRef.current) lapTimeRef.current.textContent = formatLapTime(frame.lapTime);

    const t = Math.round(frame.throttle * 100);
    const b = Math.round(frame.brake * 100);
    if (throttleRef.current) throttleRef.current.style.width = `${t}%`;
    if (brakeRef.current) brakeRef.current.style.width = `${b}%`;
  });

  return (
    <div style={styles.card}>
      <div style={styles.nameRow}>
        <span style={styles.name}>{driver.name}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span ref={speedRef} style={{ ...styles.speed, color: '#ccc' }}>0</span>
          <span style={{ fontSize: '9px', color: '#555' }}>km/h</span>
          <span style={{ fontSize: '9px', color: '#555', marginLeft: '4px' }}>G</span>
          <span ref={gearRef} style={{ fontSize: '14px', fontWeight: 700, color: '#888' }}>N</span>
        </div>
      </div>
      <div style={styles.barsWrap}>
        <div style={styles.barGroup}>
          <span style={{ ...styles.barLabel, color: '#22c55e' }}>Thr</span>
          <div style={styles.barTrack}>
            <div ref={throttleRef} style={{ ...styles.barFill, background: '#22c55e88', width: '0%' }} />
          </div>
        </div>
        <div style={styles.barGroup}>
          <span style={{ ...styles.barLabel, color: '#ef4444' }}>Brk</span>
          <div style={styles.barTrack}>
            <div ref={brakeRef} style={{ ...styles.barFill, background: '#ef444488', width: '0%' }} />
          </div>
        </div>
      </div>
      <div style={styles.statsRow}>
        <span ref={lapTimeRef}>--:--.---</span>
        <span>Best: {driver.bestLapTime ? formatLapTime(driver.bestLapTime) : '--'}</span>
      </div>
    </div>
  );
}

export function TelemetrySnippet() {
  const { drivers } = useSession();

  const connectedDrivers = Object.values(drivers || {})
    .filter((d) => d.connected)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .slice(0, 6); // Show top 6 to keep it compact

  return (
    <div style={styles.container}>
      <div style={styles.header}>Live Telemetry</div>
      <div style={styles.content}>
        {connectedDrivers.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '11px' }}>
            No drivers connected
          </div>
        ) : (
          connectedDrivers.map((d) => <DriverSnippet key={d.id} driver={d} />)
        )}
      </div>
    </div>
  );
}
