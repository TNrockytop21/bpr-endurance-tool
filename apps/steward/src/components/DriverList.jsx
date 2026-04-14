import { useState } from 'react';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflow: 'auto',
    flex: 1,
  },
  header: {
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    padding: '8px 12px 4px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background 0.1s',
    fontSize: '13px',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  name: {
    flex: 1,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  car: {
    color: '#888',
    fontSize: '11px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '120px',
  },
  lap: {
    color: '#888',
    fontSize: '11px',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  empty: {
    padding: '24px 12px',
    textAlign: 'center',
    color: '#666',
    fontSize: '12px',
  },
};

export function DriverList({ drivers, selectedDriverIds, onToggleDriver }) {
  const [hoveredId, setHoveredId] = useState(null);

  const driverList = Object.values(drivers || {}).sort((a, b) => {
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  if (driverList.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Drivers</div>
        <div style={styles.empty}>No drivers connected</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        Drivers ({driverList.filter((d) => d.connected).length} online)
      </div>
      {driverList.map((driver) => {
        const selected = selectedDriverIds.has(driver.id);
        const hovered = hoveredId === driver.id;
        return (
          <div
            key={driver.id}
            style={{
              ...styles.row,
              background: selected
                ? 'rgba(139, 92, 246, 0.15)'
                : hovered
                  ? '#1a1a1a'
                  : 'transparent',
              border: selected
                ? '1px solid rgba(139, 92, 246, 0.3)'
                : '1px solid transparent',
            }}
            onClick={() => onToggleDriver(driver.id)}
            onMouseEnter={() => setHoveredId(driver.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div
              style={{
                ...styles.statusDot,
                background: driver.connected ? '#22c55e' : '#666',
              }}
            />
            <div style={styles.name}>{driver.name}</div>
            <div style={styles.car}>{driver.car}</div>
            <div style={styles.lap}>
              L{driver.lapCount || 0}
            </div>
          </div>
        );
      })}
    </div>
  );
}
