import { useRef, useMemo } from 'react';
import { useSession } from '../../context/SessionContext';
import { useTelemetryBuffers } from '../../context/TelemetryContext';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { getTrackOutline } from '../../lib/track-outlines';
import { getSatelliteUrl } from '../../lib/track-coords';

const DRIVER_COLORS = [
  '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16',
];

// Fallback generic oval
function getOvalPosition(lapDist, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.4;
  const ry = height * 0.4;
  const angle = lapDist * Math.PI * 2 - Math.PI / 2;
  return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
}

function generateOvalPath(width, height) {
  const parts = [];
  for (let i = 0; i <= 100; i++) {
    const pos = getOvalPosition(i / 100, width, height);
    parts.push(`${i === 0 ? 'M' : 'L'} ${pos.x.toFixed(1)} ${pos.y.toFixed(1)}`);
  }
  return parts.join(' ') + ' Z';
}

function generateRealTrackPath(trackShape, width, height, padding = 15) {
  const pw = width - 2 * padding;
  const ph = height - 2 * padding;
  return trackShape
    .map((p, i) => {
      const x = padding + p.x * pw;
      const y = padding + p.y * ph;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ') + ' Z';
}

function getRealTrackPosition(lapDist, trackShape, width, height, padding = 15) {
  const idx = lapDist * (trackShape.length - 1);
  const i = Math.floor(idx);
  const t = idx - i;
  const p0 = trackShape[Math.min(i, trackShape.length - 1)];
  const p1 = trackShape[Math.min(i + 1, trackShape.length - 1)];
  const pw = width - 2 * padding;
  const ph = height - 2 * padding;
  return {
    x: padding + ((1 - t) * p0.x + t * p1.x) * pw,
    y: padding + ((1 - t) * p0.y + t * p1.y) * ph,
  };
}

export function TrackMap({ width = 300, height = 200 }) {
  const { drivers, trackShape, sessionInfo } = useSession();
  const buffersRef = useTelemetryBuffers();
  const dotsRef = useRef({});

  const driverList = Object.values(drivers).filter((d) => d.connected);

  const effectiveShape = useMemo(() => {
    const premade = getTrackOutline(sessionInfo?.trackName);
    if (premade) return premade;
    if (trackShape && trackShape.length > 0) return trackShape;
    return null;
  }, [sessionInfo?.trackName, trackShape]);

  const satellite = useMemo(
    () => getSatelliteUrl(sessionInfo?.trackName, width * 2, height * 2),
    [sessionInfo?.trackName, width, height]
  );

  const hasRealTrack = effectiveShape !== null;

  const trackPath = hasRealTrack
    ? generateRealTrackPath(effectiveShape, width, height)
    : generateOvalPath(width, height);

  function getPosition(lapDist) {
    return hasRealTrack
      ? getRealTrackPosition(lapDist, effectiveShape, width, height)
      : getOvalPosition(lapDist, width, height);
  }

  useAnimationFrame(() => {
    driverList.forEach((driver) => {
      const buffer = buffersRef.current.get(driver.id);
      if (!buffer) return;
      const frame = buffer.getLatest();
      if (!frame) return;
      const dot = dotsRef.current[driver.id];
      if (!dot) return;
      const pos = getPosition(frame.lapDist);
      dot.setAttribute('cx', pos.x.toFixed(1));
      dot.setAttribute('cy', pos.y.toFixed(1));
    });
  });

  const sfPos = getPosition(0);

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-3">
      <h3 className="text-xs text-muted uppercase font-semibold mb-2">Track Map</h3>
      <div className="relative mx-auto overflow-hidden rounded" style={{ width, height }}>
        {/* Satellite background */}
        {satellite && (
          <img
            src={satellite.url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        )}
        {/* SVG overlay */}
        <svg width={width} height={height} className="relative z-10">
          {/* Track outline */}
          <path
            d={trackPath}
            fill="none"
            stroke={satellite ? 'rgba(255,255,255,0.7)' : 'var(--color-border)'}
            strokeWidth={satellite ? 3 : 10}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {!satellite && (
            <path d={trackPath} fill="none" stroke="var(--color-canvas-grid)" strokeWidth="6" strokeLinecap="round" />
          )}

          {/* Start/finish */}
          <line x1={sfPos.x} y1={sfPos.y - 6} x2={sfPos.x} y2={sfPos.y + 6}
            stroke={satellite ? '#ffffff' : 'var(--color-muted)'} strokeWidth="2" />

          {/* Driver dots */}
          {driverList.map((driver, idx) => (
            <circle
              key={driver.id}
              ref={(el) => { if (el) dotsRef.current[driver.id] = el; }}
              cx={width / 2}
              cy={height / 2}
              r="6"
              fill={DRIVER_COLORS[idx % DRIVER_COLORS.length]}
              stroke={satellite ? '#000000' : 'var(--color-surface)'}
              strokeWidth="2"
            />
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap gap-2 mt-2 justify-center">
        {driverList.map((driver, idx) => (
          <div key={driver.id} className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: DRIVER_COLORS[idx % DRIVER_COLORS.length] }}
            />
            <span className="text-[10px] text-muted">{driver.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
