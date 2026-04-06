import { useRef, useEffect } from 'react';
import { useTelemetryBuffers } from '../../context/TelemetryContext';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';

export function ThrottleBrakeGauge({ driverId, height = 120 }) {
  const buffersRef = useTelemetryBuffers();
  const throttleRef = useRef(null);
  const brakeRef = useRef(null);
  const throttleValRef = useRef(null);
  const brakeValRef = useRef(null);

  useAnimationFrame(() => {
    const buffer = buffersRef.current.get(driverId);
    if (!buffer) return;
    const frame = buffer.getLatest();
    if (!frame) return;

    const t = Math.round(frame.throttle * 100);
    const b = Math.round(frame.brake * 100);

    if (throttleRef.current) throttleRef.current.style.height = `${t}%`;
    if (brakeRef.current) brakeRef.current.style.height = `${b}%`;
    if (throttleValRef.current) throttleValRef.current.textContent = `${t}%`;
    if (brakeValRef.current) brakeValRef.current.textContent = `${b}%`;
  });

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {/* Throttle */}
      <div className="flex flex-col items-center gap-1 flex-1">
        <span ref={throttleValRef} className="text-xs text-throttle font-mono">0%</span>
        <div className="w-full bg-surface rounded overflow-hidden relative" style={{ height: height - 24 }}>
          <div
            ref={throttleRef}
            className="absolute bottom-0 left-0 right-0 bg-throttle/80 transition-[height] duration-[40ms] rounded-t"
            style={{ height: '0%' }}
          />
        </div>
        <span className="text-[10px] text-muted uppercase">THR</span>
      </div>
      {/* Brake */}
      <div className="flex flex-col items-center gap-1 flex-1">
        <span ref={brakeValRef} className="text-xs text-brake font-mono">0%</span>
        <div className="w-full bg-surface rounded overflow-hidden relative" style={{ height: height - 24 }}>
          <div
            ref={brakeRef}
            className="absolute bottom-0 left-0 right-0 bg-brake/80 transition-[height] duration-[40ms] rounded-t"
            style={{ height: '0%' }}
          />
        </div>
        <span className="text-[10px] text-muted uppercase">BRK</span>
      </div>
    </div>
  );
}
