import { useRef, useEffect, useCallback } from 'react';
import { wsClient } from '../lib/ws-client';

// Distinct colors for car position dots
const CAR_COLORS = [
  '#a78bfa', '#22c55e', '#f59e0b', '#60a5fa',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316',
  '#8b5cf6', '#06b6d4', '#84cc16', '#e11d48',
];

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
  canvasWrap: {
    position: 'relative',
    width: '100%',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '6px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '9px',
    color: '#888',
  },
  legendDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
};

export function TrackMap({ trackShape, drivers }) {
  const canvasRef = useRef(null);
  const driversRef = useRef(drivers);
  const frameRef = useRef(null);

  driversRef.current = drivers;

  // Subscribe to telemetry frames to update car positions
  const latestFrames = useRef(new Map());

  useEffect(() => {
    const unsub = wsClient.on('telemetry:frame', (payload) => {
      latestFrames.current.set(payload.driverId, payload);
    });
    return unsub;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !trackShape || trackShape.length === 0) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = Math.min(w * 0.6, 250);
    canvas.width = w * 2; // retina
    canvas.height = h * 2;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(2, 2);

    ctx.clearRect(0, 0, w, h);

    // Compute track bounds with padding
    const pad = 20;
    const points = trackShape;
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

    // Draw track outline
    ctx.beginPath();
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    const first = toScreen(points[0]);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const p = toScreen(points[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw car positions
    const driversList = Object.values(driversRef.current || {});
    let colorIdx = 0;
    for (const driver of driversList) {
      if (!driver.connected) continue;
      const frame = latestFrames.current.get(driver.id);
      if (!frame || frame.lapDist == null) continue;

      // Map lapDist (0-1) to track point
      const idx = Math.min(
        Math.floor(frame.lapDist * points.length),
        points.length - 1
      );
      const pos = toScreen(points[idx]);
      const color = CAR_COLORS[colorIdx % CAR_COLORS.length];

      // Car dot
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Pit road indicator
      if (frame.onPitRoad) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      colorIdx++;
    }

    frameRef.current = requestAnimationFrame(draw);
  }, [trackShape]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [draw]);

  const driversList = Object.values(drivers || {}).filter((d) => d.connected);

  if (!trackShape || trackShape.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.label}>Track Map</div>
        <div style={{ color: '#444', fontSize: '11px', textAlign: 'center', padding: '16px 0' }}>
          Waiting for track data...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.label}>Track Map</div>
      <div style={styles.canvasWrap}>
        <canvas ref={canvasRef} />
      </div>
      <div style={styles.legend}>
        {driversList.map((d, i) => (
          <div key={d.id} style={styles.legendItem}>
            <div style={{ ...styles.legendDot, background: CAR_COLORS[i % CAR_COLORS.length] }} />
            {d.name}
          </div>
        ))}
      </div>
    </div>
  );
}
