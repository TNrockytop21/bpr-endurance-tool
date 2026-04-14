import { useRef, useState, useEffect } from 'react';
import { useTelemetryBuffers } from '../../context/TelemetryContext';
import { useSession } from '../../context/SessionContext';

const styles = {
  container: {
    background: '#0d0d0f',
    border: '1px solid #1a1a1a',
    borderRadius: '4px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  label: {
    fontSize: '9px',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    marginBottom: '4px',
  },
  time: {
    fontSize: '28px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '1px',
  },
  elapsed: {
    fontSize: '12px',
    color: '#555',
    fontVariantNumeric: 'tabular-nums',
    marginTop: '6px',
  },
};

function formatHMS(seconds) {
  if (seconds == null || seconds < 0) return '--:--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function SessionTimer() {
  const { drivers, sessionInfo } = useSession();
  const buffersRef = useTelemetryBuffers();
  const [remaining, setRemaining] = useState(null);
  const [elapsed, setElapsed] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      // Get latest frame from any connected driver
      for (const [, buffer] of buffersRef.current) {
        const frame = buffer.getLatest();
        if (frame) {
          if (frame.sessionTimeRemain != null) setRemaining(frame.sessionTimeRemain);
          if (frame.sessionTime != null) setElapsed(frame.sessionTime);
          break;
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [buffersRef]);

  const isLow = remaining != null && remaining < 600; // last 10 minutes
  const isCritical = remaining != null && remaining < 120; // last 2 minutes

  return (
    <div style={styles.container}>
      <div style={styles.label}>Remaining</div>
      <div style={{
        ...styles.time,
        color: isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#ccc',
      }}>
        {formatHMS(remaining)}
      </div>
      <div style={styles.elapsed}>
        Elapsed: {formatHMS(elapsed)}
      </div>
      {sessionInfo?.trackName && (
        <div style={{ fontSize: '10px', color: '#444', marginTop: '4px' }}>
          {sessionInfo.trackName}
        </div>
      )}
    </div>
  );
}
