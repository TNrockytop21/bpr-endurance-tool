import { useCallback } from 'react';

const styles = {
  container: {
    background: '#0d0d0f',
    border: '1px solid #1a1a1a',
    borderRadius: '4px',
    padding: '12px',
    flexShrink: 0,
  },
  label: {
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  row: {
    display: 'flex',
    gap: '6px',
  },
  btn: {
    padding: '6px 14px',
    borderRadius: '3px',
    border: '1px solid #2a2a2a',
    background: '#1a1a1a',
    color: '#ccc',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

function formatTime(t) {
  if (t == null) return '--:--';
  const mins = Math.floor(t / 60);
  const secs = Math.floor(t % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleString();
}

function generateCSV(sessionInfo, drivers, incidents, penalties) {
  const lines = [];

  // Header
  lines.push('BPR Race Control — Post-Race Report');
  lines.push(`Track: ${sessionInfo?.trackName || 'Unknown'}`);
  lines.push(`Date: ${formatDate(Date.now())}`);
  lines.push('');

  // Incidents
  lines.push('INCIDENTS');
  lines.push('Time,Type,Drivers,Status,Notes');
  for (const inc of incidents) {
    const driverNames = (inc.involvedDrivers || [])
      .map((id) => drivers[id]?.name || id)
      .join(' / ');
    const type = inc.incidentType || (inc.detectedBy === 'auto' ? 'auto' : 'manual');
    lines.push(
      `${formatTime(inc.sessionTime)},${type},"${driverNames}",${inc.status},"${inc.notes || ''}"`
    );
  }
  lines.push('');

  // Penalties
  lines.push('PENALTIES');
  lines.push('Driver,Penalty,Time (s),Notes');
  for (const inc of incidents) {
    if (!inc.penalty) continue;
    const driverNames = (inc.involvedDrivers || [])
      .map((id) => drivers[id]?.name || id)
      .join(' / ');
    const p = inc.penalty;
    lines.push(
      `"${driverNames}",${p.type},${p.timeSeconds || ''},${p.notes || ''}`
    );
  }
  lines.push('');

  // Driver summary
  lines.push('DRIVER SUMMARY');
  lines.push('Driver,Laps,Contacts,Off-Track,Blue Flags,Total Inc Points,Penalties');
  for (const driver of Object.values(drivers)) {
    const driverIncs = incidents.filter((i) => i.involvedDrivers?.includes(driver.id));
    const contacts = driverIncs.filter((i) => i.incidentType === 'contact' || i.delta >= 2).length;
    const offTrack = driverIncs.filter((i) => i.incidentType === 'off-track' || i.delta === 1).length;
    const blueFlag = driverIncs.filter((i) => i.incidentType === 'blue-flag').length;
    const incPts = driverIncs.reduce((s, i) => s + (i.delta || 0), 0);
    const penCount = driverIncs.filter((i) => i.penalty && i.penalty.type !== 'no-action' && i.penalty.type !== 'race-incident').length;
    lines.push(
      `"${driver.name}",${driver.lapCount || 0},${contacts},${offTrack},${blueFlag},${incPts},${penCount}`
    );
  }

  return lines.join('\n');
}

function generateJSON(sessionInfo, drivers, incidents) {
  return JSON.stringify({
    report: 'BPR Race Control — Post-Race Report',
    track: sessionInfo?.trackName || 'Unknown',
    exportedAt: new Date().toISOString(),
    incidents: incidents.map((inc) => ({
      sessionTime: inc.sessionTime,
      type: inc.incidentType || 'manual',
      drivers: (inc.involvedDrivers || []).map((id) => drivers[id]?.name || id),
      status: inc.status,
      notes: inc.notes,
      penalty: inc.penalty || null,
    })),
    drivers: Object.values(drivers).map((d) => ({
      name: d.name,
      car: d.car,
      lapCount: d.lapCount || 0,
    })),
  }, null, 2);
}

function download(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportExport({ sessionInfo, drivers, incidents, penalties }) {
  const handleCSV = useCallback(() => {
    const csv = generateCSV(sessionInfo, drivers, incidents, penalties);
    const track = (sessionInfo?.trackName || 'race').replace(/\s+/g, '_');
    download(csv, `BPR_Report_${track}.csv`, 'text/csv');
  }, [sessionInfo, drivers, incidents, penalties]);

  const handleJSON = useCallback(() => {
    const json = generateJSON(sessionInfo, drivers, incidents);
    const track = (sessionInfo?.trackName || 'race').replace(/\s+/g, '_');
    download(json, `BPR_Report_${track}.json`, 'application/json');
  }, [sessionInfo, drivers, incidents]);

  return (
    <div style={styles.container}>
      <div style={styles.label}>Post-Race Report</div>
      <div style={styles.row}>
        <button style={styles.btn} onClick={handleCSV}>Export CSV</button>
        <button style={styles.btn} onClick={handleJSON}>Export JSON</button>
      </div>
    </div>
  );
}
