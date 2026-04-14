import { useRef, useEffect, useMemo } from 'react';

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
  stats: {
    display: 'flex',
    gap: '12px',
    marginTop: '6px',
    fontSize: '10px',
    color: '#666',
  },
};

/**
 * Renders a heatmap of incident locations on the track shape.
 * Brighter = more incidents at that part of the track.
 */
export function IncidentHeatmap({ trackShape, incidents }) {
  const canvasRef = useRef(null);

  // Bin incidents by lapDist into track segments
  const heatData = useMemo(() => {
    if (!trackShape || trackShape.length === 0) return null;

    const numBins = trackShape.length;
    const bins = new Array(numBins).fill(0);
    let maxVal = 0;

    for (const inc of incidents) {
      if (inc.lapDist == null && inc.involvedDrivers) continue;
      const dist = inc.lapDist ?? 0;
      const idx = Math.min(Math.floor(dist * numBins), numBins - 1);
      bins[idx]++;
      // Spread to neighbors for smooth heatmap
      if (idx > 0) bins[idx - 1] += 0.5;
      if (idx < numBins - 1) bins[idx + 1] += 0.5;
    }

    for (const v of bins) {
      if (v > maxVal) maxVal = v;
    }

    return { bins, maxVal };
  }, [trackShape, incidents]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !trackShape || trackShape.length === 0 || !heatData) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = Math.min(w * 0.5, 200);
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(2, 2);

    ctx.clearRect(0, 0, w, h);

    const points = trackShape;
    const pad = 16;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale = Math.min((w - pad * 2) / rangeX, (h - pad * 2) / rangeY);
    const offX = (w - rangeX * scale) / 2;
    const offY = (h - rangeY * scale) / 2;

    const toScreen = (p) => ({
      x: (p.x - minX) * scale + offX,
      y: (p.y - minY) * scale + offY,
    });

    // Draw track with heat coloring
    const { bins, maxVal } = heatData;

    for (let i = 0; i < points.length - 1; i++) {
      const a = toScreen(points[i]);
      const b = toScreen(points[i + 1]);
      const intensity = maxVal > 0 ? bins[i] / maxVal : 0;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);

      if (intensity > 0) {
        // Gradient from amber to red based on intensity
        const r = Math.round(239 + (239 - 239) * intensity);
        const g = Math.round(68 + (158 - 68) * (1 - intensity));
        const bVal = Math.round(68 * (1 - intensity));
        ctx.strokeStyle = `rgba(${r}, ${g}, ${bVal}, ${0.3 + intensity * 0.7})`;
        ctx.lineWidth = 3 + intensity * 5;
      } else {
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 2;
      }
      ctx.stroke();
    }

    // Draw incident dots
    for (const inc of incidents) {
      const dist = inc.lapDist;
      if (dist == null) continue;
      const idx = Math.min(Math.floor(dist * points.length), points.length - 1);
      const pos = toScreen(points[idx]);

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = inc.incidentType === 'contact' ? '#ef4444' :
                       inc.incidentType === 'blue-flag' ? '#60a5fa' : '#f59e0b';
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, [trackShape, heatData, incidents]);

  const incWithLocation = incidents.filter((i) => i.lapDist != null);
  const contactCount = incidents.filter((i) => i.incidentType === 'contact').length;
  const totalCount = incidents.length;

  if (!trackShape || trackShape.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.label}>Incident Heatmap</div>
        <div style={{ color: '#444', fontSize: '11px' }}>Waiting for track data...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.label}>Incident Heatmap</div>
      <canvas ref={canvasRef} />
      <div style={styles.stats}>
        <span>{totalCount} total incidents</span>
        <span>{contactCount} contacts</span>
        <span>{incWithLocation} mapped</span>
      </div>
    </div>
  );
}
