import { useRef, useEffect, useState, useMemo } from 'react';
import { useTelemetryBuffers } from '../../context/TelemetryContext';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { findBrakingPoints } from '../../lib/trace-analysis';

const THROTTLE_COLOR = '#22c55e';
const BRAKE_COLOR = '#ef4444';
const STEER_COLOR = '#a78bfa';

const RIGHT_PAD = 10;
const TOP_PAD = 4;
const BOTTOM_PAD = 18;

function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    bg: style.getPropertyValue('--color-canvas-bg').trim() || '#0f1117',
    grid: style.getPropertyValue('--color-canvas-grid').trim() || '#1a1d27',
    muted: style.getPropertyValue('--color-muted').trim() || '#6b7280',
    border: style.getPropertyValue('--color-border').trim() || '#2e3140',
  };
}

export function LiveTraceCanvas({ driverId, height = 150, ghostTrace = null }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const buffersRef = useTelemetryBuffers();
  const [canvasWidth, setCanvasWidth] = useState(800);
  const colorsRef = useRef(getThemeColors());
  const zoomRef = useRef(100); // zoom percentage

  // Listen for zoom events from Stream Deck or mouse wheel
  useEffect(() => {
    function onZoom(e) {
      if (e.detail?.target === 'telemetry') {
        zoomRef.current = Math.max(25, Math.min(400, zoomRef.current + (e.detail.ticks || 0) * 10));
      }
    }
    function onWheel(e) {
      if (containerRef.current?.contains(e.target)) {
        e.preventDefault();
        zoomRef.current = Math.max(25, Math.min(400, zoomRef.current + (e.deltaY > 0 ? -10 : 10)));
      }
    }
    window.addEventListener('bpr:zoom', onZoom);
    containerRef.current?.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('bpr:zoom', onZoom);
    };
  }, []);

  // Compute braking points from ghost trace (only when ghost changes)
  const brakingPoints = useMemo(
    () => (ghostTrace ? findBrakingPoints(ghostTrace) : []),
    [ghostTrace]
  );

  // Observe container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setCanvasWidth(Math.floor(w));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Refresh colors on theme change (watch for class changes on <html>)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      colorsRef.current = getThemeColors();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    colorsRef.current = getThemeColors();
    return () => observer.disconnect();
  }, []);

  // Set up canvas HiDPI
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [canvasWidth, height]);

  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const buffer = buffersRef.current.get(driverId);
    if (!buffer) return;

    const frames = buffer.getCurrentLapFrames();
    const w = canvasWidth;
    const h = height;
    const colors = colorsRef.current;

    // Responsive left padding
    const LEFT_PAD = w < 400 ? 40 : 60;
    const plotLeft = LEFT_PAD;
    const plotRight = w - RIGHT_PAD;
    const plotTop = TOP_PAD;
    const plotBottom = h - BOTTOM_PAD;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;

    // Clear
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    // Y-axis labels and horizontal grid
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    for (const pct of [0, 0.25, 0.5, 0.75, 1.0]) {
      const y = plotBottom - pct * plotH;
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
      ctx.fillStyle = colors.muted;
      ctx.fillText(`${(pct * 100).toFixed(0)}%`, plotLeft - 4, y + 3);
    }

    // Vertical grid lines every 10% + distance labels
    ctx.textAlign = 'center';
    for (let pct = 0; pct <= 100; pct += 10) {
      const x = plotLeft + (pct / 100) * plotW;
      if (pct > 0 && pct < 100) {
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, plotTop);
        ctx.lineTo(x, plotBottom);
        ctx.stroke();
      }
      if (pct % 20 === 0) {
        ctx.fillStyle = colors.border;
        ctx.font = '9px monospace';
        ctx.fillText(`${pct}`, x, h - 3);
      }
    }

    // Ghost trace (best lap overlay)
    if (ghostTrace && ghostTrace.length > 0) {
      ctx.globalAlpha = 0.2;
      ctx.setLineDash([4, 4]);
      function drawGhost(channel, color) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        for (let i = 0; i < ghostTrace.length; i++) {
          const x = plotLeft + (i / ghostTrace.length) * plotW;
          const y = plotBottom - (ghostTrace[i][channel] || 0) * plotH;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      drawGhost('throttle', THROTTLE_COLOR);
      drawGhost('brake', BRAKE_COLOR);
      // Ghost steering
      ctx.globalAlpha = 0.12;
      ctx.setLineDash([]);
      function drawGhostSteer() {
        ctx.beginPath();
        ctx.strokeStyle = STEER_COLOR;
        ctx.lineWidth = 1;
        for (let i = 0; i < ghostTrace.length; i++) {
          const x = plotLeft + (i / ghostTrace.length) * plotW;
          const steerNorm = ((ghostTrace[i].steer || 0) + 90) / 180; // normalize -90..+90 to 0..1
          const y = plotBottom - Math.max(0, Math.min(1, steerNorm)) * plotH;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      drawGhostSteer();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
    }

    // Braking point markers from ghost trace
    if (brakingPoints.length > 0 && ghostTrace) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#f59e0b60';
      ctx.lineWidth = 1;
      for (const bp of brakingPoints) {
        const x = plotLeft + (bp.bin / ghostTrace.length) * plotW;
        ctx.beginPath();
        ctx.moveTo(x, plotTop);
        ctx.lineTo(x, plotBottom);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    if (frames.length < 2) {
      ctx.fillStyle = colors.muted;
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for lap data...', w / 2, h / 2);
      return;
    }

    // Live traces
    function drawTrace(channel, color) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      let started = false;
      for (let i = 0; i < frames.length; i++) {
        const x = plotLeft + frames[i].lapDist * plotW;
        const y = plotBottom - frames[i][channel] * plotH;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    drawTrace('throttle', THROTTLE_COLOR);
    drawTrace('brake', BRAKE_COLOR);

    // Steering trace (faint)
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.strokeStyle = STEER_COLOR;
    ctx.lineWidth = 1;
    let steerStarted = false;
    for (let i = 0; i < frames.length; i++) {
      const x = plotLeft + frames[i].lapDist * plotW;
      const steerNorm = ((frames[i].steer || 0) + 90) / 180;
      const y = plotBottom - Math.max(0, Math.min(1, steerNorm)) * plotH;
      if (!steerStarted) { ctx.moveTo(x, y); steerStarted = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Progress cursor
    const lastFrame = frames[frames.length - 1];
    const cursorX = plotLeft + lastFrame.lapDist * plotW;
    ctx.strokeStyle = colors.muted + '40';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cursorX, plotTop);
    ctx.lineTo(cursorX, plotBottom);
    ctx.stroke();

    // Labels
    ctx.textAlign = 'left';
    ctx.font = '10px monospace';
    ctx.fillStyle = THROTTLE_COLOR;
    ctx.fillText('THR', plotLeft + 4, plotTop + 12);
    ctx.fillStyle = BRAKE_COLOR;
    ctx.fillText('BRK', plotLeft + 36, plotTop + 12);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = STEER_COLOR;
    ctx.fillText('STR', plotLeft + 68, plotTop + 12);
    ctx.globalAlpha = 1.0;
    if (ghostTrace) {
      ctx.fillStyle = colors.muted;
      ctx.fillText('BEST', plotLeft + 68, plotTop + 12);
    }

    ctx.fillStyle = colors.muted;
    ctx.textAlign = 'left';
    ctx.fillText(`${(lastFrame.lapDist * 100).toFixed(0)}%`, cursorX + 4, plotTop + 12);
  });

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="rounded border border-border w-full"
        style={{ height }}
      />
    </div>
  );
}
