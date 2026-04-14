import { useState, useCallback, useMemo } from 'react';

const SPEEDS = [
  { label: '¼x', value: 0.25 },
  { label: '½x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '4x', value: 4 },
];

// iRacing camera group IDs — these map to BroadcastMsg(CamSwitchNum, carIdx, camGroup)
// Actual group numbers vary by track, but these are the standard group names.
// The IPC handler will resolve names to group IDs when SDK is live.
const CAMERAS = [
  { id: 'cockpit',    label: 'Cockpit',    icon: '🏎' },
  { id: 'chase',      label: 'Chase',      icon: '↩' },
  { id: 'far-chase',  label: 'Far Chase',  icon: '⟵' },
  { id: 'front',      label: 'Front',      icon: '⟶' },
  { id: 'rear',       label: 'Rear',       icon: '↪' },
  { id: 'chopper',    label: 'Chopper',    icon: '⬆' },
  { id: 'blimp',      label: 'Blimp',      icon: '◉' },
];

const styles = {
  container: {
    background: '#0d0d0f',
    border: '1px solid #1a1a1a',
    borderRadius: '4px',
    padding: '10px 14px',
    flexShrink: 0,
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  title: {
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  },
  sdkStatus: {
    fontSize: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  statusDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  group: {
    display: 'flex',
    gap: '3px',
    alignItems: 'center',
  },
  separator: {
    width: '1px',
    height: '22px',
    background: '#222',
    margin: '0 5px',
    flexShrink: 0,
  },
  groupLabel: {
    fontSize: '9px',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginRight: '4px',
    flexShrink: 0,
  },
  btn: {
    padding: '5px 9px',
    borderRadius: '3px',
    border: '1px solid #2a2a2a',
    background: '#1a1a1a',
    color: '#ccc',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.1s, border-color 0.1s',
    minWidth: '32px',
    whiteSpace: 'nowrap',
  },
  btnActive: {
    background: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    color: '#a78bfa',
  },
  playBtn: {
    padding: '5px 12px',
    minWidth: '38px',
  },
  smallBtn: {
    padding: '4px 7px',
    fontSize: '11px',
    color: '#888',
    background: 'transparent',
    border: '1px solid #222',
    borderRadius: '3px',
    cursor: 'pointer',
  },
  driverNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
  },
  driverLabel: {
    fontSize: '11px',
    color: '#a78bfa',
    fontWeight: 600,
    minWidth: '80px',
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  navBtn: {
    padding: '4px 8px',
    borderRadius: '3px',
    border: '1px solid #2a2a2a',
    background: '#1a1a1a',
    color: '#ccc',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    lineHeight: 1,
  },
  camBtn: {
    padding: '4px 8px',
    borderRadius: '3px',
    border: '1px solid #222',
    background: 'transparent',
    color: '#888',
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  camBtnActive: {
    background: 'rgba(96, 165, 250, 0.12)',
    borderColor: 'rgba(96, 165, 250, 0.35)',
    color: '#60a5fa',
  },
};

export function ReplayControls({ irsdkConnected, drivers }) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [activeCamera, setActiveCamera] = useState('chase');
  const [focusedDriverIdx, setFocusedDriverIdx] = useState(0);

  const irsdk = window.irsdk;

  const driverList = useMemo(() => {
    return Object.values(drivers || {})
      .filter((d) => d.connected)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [drivers]);

  const focusedDriver = driverList[focusedDriverIdx] || null;

  const handlePlayPause = useCallback(() => {
    const newPlaying = !playing;
    setPlaying(newPlaying);
    irsdk?.replaySpeed(newPlaying ? speed : 0);
  }, [playing, speed, irsdk]);

  const handleSpeed = useCallback((s) => {
    setSpeed(s);
    if (playing) {
      irsdk?.replaySpeed(s);
    }
  }, [playing, irsdk]);

  const handleJump = useCallback((offsetSeconds) => {
    console.log(`[replay] jump ${offsetSeconds > 0 ? '+' : ''}${offsetSeconds}s`);
  }, []);

  const handlePrevDriver = useCallback(() => {
    setFocusedDriverIdx((prev) => {
      const next = prev <= 0 ? driverList.length - 1 : prev - 1;
      const driver = driverList[next];
      if (driver) irsdk?.replayCamera(next, activeCamera);
      return next;
    });
  }, [driverList, activeCamera, irsdk]);

  const handleNextDriver = useCallback(() => {
    setFocusedDriverIdx((prev) => {
      const next = prev >= driverList.length - 1 ? 0 : prev + 1;
      const driver = driverList[next];
      if (driver) irsdk?.replayCamera(next, activeCamera);
      return next;
    });
  }, [driverList, activeCamera, irsdk]);

  const handleCamera = useCallback((camId) => {
    setActiveCamera(camId);
    irsdk?.replayCamera(focusedDriverIdx, camId);
  }, [focusedDriverIdx, irsdk]);

  const handleGoLive = useCallback(() => {
    setPlaying(true);
    setSpeed(1);
    irsdk?.replaySpeed(1);
    // Jump to end of replay = live. Uses -1 as sentinel for "go to live".
    irsdk?.replayJump(-1);
    console.log('[replay] go to live');
  }, [irsdk]);

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <span style={styles.title}>Replay Controls</span>
        <div style={styles.sdkStatus}>
          <div style={{
            ...styles.statusDot,
            background: irsdkConnected ? '#22c55e' : '#666',
          }} />
          <span style={{ color: irsdkConnected ? '#22c55e' : '#666' }}>
            {irsdkConnected ? 'iRacing' : 'SDK not connected'}
          </span>
        </div>
      </div>

      <div style={styles.controlsRow}>
        {/* Play / Pause */}
        <button
          style={{
            ...styles.btn,
            ...styles.playBtn,
            ...(playing ? styles.btnActive : {}),
          }}
          onClick={handlePlayPause}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? '⏸' : '▶'}
        </button>

        {/* Live */}
        <button
          style={{
            ...styles.btn,
            background: 'rgba(239, 68, 68, 0.12)',
            borderColor: 'rgba(239, 68, 68, 0.4)',
            color: '#ef4444',
            fontWeight: 700,
            fontSize: '10px',
            letterSpacing: '0.5px',
          }}
          onClick={handleGoLive}
          title="Jump to live"
        >
          LIVE
        </button>

        {/* Speed */}
        <div style={styles.separator} />
        <div style={styles.group}>
          <span style={styles.groupLabel}>Speed</span>
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              style={{
                ...styles.smallBtn,
                ...(speed === s.value ? styles.btnActive : {}),
              }}
              onClick={() => handleSpeed(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Jump */}
        <div style={styles.separator} />
        <div style={styles.group}>
          <span style={styles.groupLabel}>Jump</span>
          <button style={styles.smallBtn} onClick={() => handleJump(-10)}>-10s</button>
          <button style={styles.smallBtn} onClick={() => handleJump(-5)}>-5s</button>
          <button style={styles.smallBtn} onClick={() => handleJump(5)}>+5s</button>
          <button style={styles.smallBtn} onClick={() => handleJump(10)}>+10s</button>
        </div>

        {/* Driver nav */}
        <div style={styles.separator} />
        <div style={styles.group}>
          <span style={styles.groupLabel}>Driver</span>
          <div style={styles.driverNav}>
            <button style={styles.navBtn} onClick={handlePrevDriver} title="Previous driver">◀</button>
            <span style={styles.driverLabel}>
              {focusedDriver?.name || 'None'}
            </span>
            <button style={styles.navBtn} onClick={handleNextDriver} title="Next driver">▶</button>
          </div>
        </div>

        {/* Camera views */}
        <div style={styles.separator} />
        <div style={styles.group}>
          <span style={styles.groupLabel}>Camera</span>
          {CAMERAS.map((cam) => (
            <button
              key={cam.id}
              style={{
                ...styles.camBtn,
                ...(activeCamera === cam.id ? styles.camBtnActive : {}),
              }}
              onClick={() => handleCamera(cam.id)}
              title={cam.label}
            >
              {cam.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
