import { useMemo } from 'react';

const styles = {
  container: {
    background: '#0d0d0f',
    border: '1px solid #1a1a1a',
    borderRadius: '4px',
    padding: '12px',
    overflow: 'auto',
  },
  label: {
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px',
  },
  th: {
    textAlign: 'left',
    padding: '4px 8px',
    color: '#666',
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #1a1a1a',
    fontWeight: 600,
  },
  td: {
    padding: '5px 8px',
    borderBottom: '1px solid #111',
    fontVariantNumeric: 'tabular-nums',
  },
  driverName: {
    fontWeight: 600,
    color: '#ccc',
  },
  statGood: {
    color: '#22c55e',
  },
  statWarn: {
    color: '#f59e0b',
  },
  statBad: {
    color: '#ef4444',
  },
  penaltyBadge: {
    display: 'inline-block',
    padding: '1px 5px',
    borderRadius: '2px',
    fontSize: '9px',
    fontWeight: 600,
    marginRight: '3px',
  },
};

export function DriverSummaryPanel({ drivers, incidents, penalties }) {
  const summaries = useMemo(() => {
    const driverList = Object.values(drivers || {});
    return driverList.map((driver) => {
      const driverIncidents = (incidents || []).filter((inc) =>
        inc.involvedDrivers?.includes(driver.id)
      );
      const driverPenalties = (penalties || []).filter((p) =>
        p.incidentId && driverIncidents.some((inc) => inc.id === p.incidentId)
      );

      const contactCount = driverIncidents.filter((i) => i.incidentType === 'contact' || i.delta >= 2).length;
      const offTrackCount = driverIncidents.filter((i) => i.incidentType === 'off-track' || i.delta === 1).length;
      const blueFlagCount = driverIncidents.filter((i) => i.incidentType === 'blue-flag').length;
      const penaltyCount = driverPenalties.filter((p) => p.type !== 'no-action' && p.type !== 'race-incident').length;

      const totalIncidentPoints = driverIncidents.reduce((sum, i) => sum + (i.delta || 0), 0);

      return {
        id: driver.id,
        name: driver.name,
        connected: driver.connected,
        lapCount: driver.lapCount || 0,
        contactCount,
        offTrackCount,
        blueFlagCount,
        penaltyCount,
        totalIncidentPoints,
        totalIncidents: driverIncidents.length,
      };
    }).sort((a, b) => b.totalIncidents - a.totalIncidents);
  }, [drivers, incidents, penalties]);

  if (summaries.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.label}>Driver Summary</div>
        <div style={{ color: '#555', fontSize: '12px' }}>No drivers connected</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.label}>Driver Summary</div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Driver</th>
            <th style={{ ...styles.th, textAlign: 'center' }}>Laps</th>
            <th style={{ ...styles.th, textAlign: 'center' }}>Contact</th>
            <th style={{ ...styles.th, textAlign: 'center' }}>Off-Track</th>
            <th style={{ ...styles.th, textAlign: 'center' }}>Blue Flag</th>
            <th style={{ ...styles.th, textAlign: 'center' }}>Inc Pts</th>
            <th style={{ ...styles.th, textAlign: 'center' }}>Penalties</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => (
            <tr key={s.id}>
              <td style={styles.td}>
                <span style={styles.driverName}>{s.name}</span>
                {!s.connected && (
                  <span style={{ color: '#555', fontSize: '9px', marginLeft: '4px' }}>OFF</span>
                )}
              </td>
              <td style={{ ...styles.td, textAlign: 'center', color: '#888' }}>{s.lapCount}</td>
              <td style={{
                ...styles.td,
                textAlign: 'center',
                color: s.contactCount > 0 ? '#ef4444' : '#444',
              }}>
                {s.contactCount}
              </td>
              <td style={{
                ...styles.td,
                textAlign: 'center',
                color: s.offTrackCount > 0 ? '#888' : '#444',
              }}>
                {s.offTrackCount}
              </td>
              <td style={{
                ...styles.td,
                textAlign: 'center',
                color: s.blueFlagCount > 0 ? '#60a5fa' : '#444',
              }}>
                {s.blueFlagCount}
              </td>
              <td style={{
                ...styles.td,
                textAlign: 'center',
                fontWeight: 600,
                color: s.totalIncidentPoints === 0
                  ? '#444'
                  : s.totalIncidentPoints <= 4
                    ? '#f59e0b'
                    : '#ef4444',
              }}>
                {s.totalIncidentPoints}
              </td>
              <td style={{
                ...styles.td,
                textAlign: 'center',
                fontWeight: 600,
                color: s.penaltyCount > 0 ? '#ef4444' : '#444',
              }}>
                {s.penaltyCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
