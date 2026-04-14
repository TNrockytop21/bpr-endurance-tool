import { useMemo } from 'react';
import { useSession } from '../../context/SessionContext';

const BATTLE_THRESHOLD = 1.5; // seconds

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
  list: {
    flex: 1,
    overflow: 'auto',
    padding: '6px',
  },
  battle: {
    background: '#111',
    border: '1px solid #1a1a1a',
    borderRadius: '3px',
    padding: '8px 10px',
    marginBottom: '4px',
  },
  battleHot: {
    borderColor: '#ef444444',
    background: 'rgba(239,68,68,0.04)',
  },
  positions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
  },
  driver: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  pos: {
    fontWeight: 700,
    fontSize: '11px',
    width: '20px',
    textAlign: 'center',
  },
  name: {
    fontWeight: 600,
    color: '#ccc',
    fontSize: '12px',
  },
  gap: {
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    fontSize: '13px',
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#333',
    fontSize: '11px',
  },
};

export function BattleTracker() {
  const { standings } = useSession();

  const battles = useMemo(() => {
    if (!standings || standings.length < 2) return [];
    const result = [];

    for (let i = 1; i < standings.length; i++) {
      const ahead = standings[i - 1];
      const behind = standings[i];
      const gap = behind.interval;

      if (gap != null && gap > 0 && gap <= BATTLE_THRESHOLD) {
        result.push({
          ahead,
          behind,
          gap,
          hot: gap <= 0.5,
        });
      }
    }

    return result.sort((a, b) => a.gap - b.gap);
  }, [standings]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        Battles ({battles.length})
      </div>
      {battles.length === 0 ? (
        <div style={styles.empty}>No close battles</div>
      ) : (
        <div style={styles.list}>
          {battles.map((b, i) => (
            <div key={i} style={{ ...styles.battle, ...(b.hot ? styles.battleHot : {}) }}>
              <div style={styles.positions}>
                <div style={styles.driver}>
                  <span style={{ ...styles.pos, color: b.ahead.pos <= 3 ? '#f59e0b' : '#666' }}>P{b.ahead.pos}</span>
                  <span style={styles.name}>{b.ahead.name}</span>
                </div>
                <span style={{
                  ...styles.gap,
                  color: b.hot ? '#ef4444' : b.gap <= 1.0 ? '#f59e0b' : '#888',
                }}>
                  {b.gap.toFixed(1)}s
                </span>
                <div style={styles.driver}>
                  <span style={styles.name}>{b.behind.name}</span>
                  <span style={{ ...styles.pos, color: '#666' }}>P{b.behind.pos}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
