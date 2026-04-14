import { useEffect, useRef, useMemo } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

// One color per driver slot (up to 8 drivers compared simultaneously)
const DRIVER_COLORS = [
  '#a78bfa', // purple
  '#22c55e', // green
  '#f59e0b', // amber
  '#60a5fa', // blue
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

const CHARTS = [
  { key: 'throttle', label: 'Throttle', unit: '%', scale: [0, 1], fmt: (v) => `${(v * 100).toFixed(0)}%` },
  { key: 'brake',    label: 'Brake',    unit: '%', scale: [0, 1], fmt: (v) => `${(v * 100).toFixed(0)}%` },
  { key: 'speed',    label: 'Speed',    unit: 'km/h', scale: null, fmt: (v) => `${(v * 3.6).toFixed(0)}` },
  { key: 'steer',    label: 'Steer',    unit: 'deg', scale: null, fmt: (v) => `${v.toFixed(1)}°` },
];

const styles = {
  container: {
    flex: 1,
    background: '#0d0d0f',
    border: '1px solid #1a1a1a',
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '1px solid #1a1a1a',
    flexShrink: 0,
  },
  title: {
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  },
  legend: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '2px',
  },
  body: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#444',
    fontSize: '13px',
    padding: '20px',
    textAlign: 'center',
  },
  chartsWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 14px 14px',
    overflow: 'hidden',
  },
  chartSection: {
    flex: 1,
    marginBottom: '4px',
  },
  chartLabel: {
    fontSize: '9px',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '4px 0 2px',
  },
};

function formatSessionTime(t) {
  const mins = Math.floor(t / 60);
  const secs = Math.floor(t % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Build uPlot-compatible data arrays from incident frame data.
 *
 * Returns { timestamps: Float64Array, series: { driverId: { throttle, brake, speed, steer } } }
 * All drivers' data is interpolated onto a shared timestamp grid.
 */
function buildChartData(frames, driverIds) {
  // Collect all unique timestamps and sort
  const tsSet = new Set();
  for (const driverId of driverIds) {
    const driverFrames = frames[driverId] || [];
    for (const f of driverFrames) {
      if (f.sessionTime != null) tsSet.add(f.sessionTime);
    }
  }
  const timestamps = Float64Array.from([...tsSet].sort((a, b) => a - b));
  if (timestamps.length === 0) return null;

  // For each driver, build channel arrays aligned to the shared timestamps.
  // Use nearest-neighbor lookup (frames are ~50ms apart, so exact match or ±1 is fine).
  const series = {};
  for (const driverId of driverIds) {
    const driverFrames = frames[driverId] || [];
    if (driverFrames.length === 0) {
      series[driverId] = null;
      continue;
    }

    const channels = {};
    for (const ch of CHARTS) {
      channels[ch.key] = new Float64Array(timestamps.length);
    }

    let fi = 0;
    for (let ti = 0; ti < timestamps.length; ti++) {
      const t = timestamps[ti];
      // Advance fi to nearest frame
      while (fi < driverFrames.length - 1 &&
        Math.abs(driverFrames[fi + 1].sessionTime - t) <= Math.abs(driverFrames[fi].sessionTime - t)) {
        fi++;
      }
      const f = driverFrames[fi];
      for (const ch of CHARTS) {
        channels[ch.key][ti] = f[ch.key] ?? 0;
      }
    }
    series[driverId] = channels;
  }

  return { timestamps, series };
}

function TelemetryChart({ chartDef, timestamps, driverIds, seriesData, driverColors, syncKey }) {
  const containerRef = useRef(null);
  const plotRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !timestamps || timestamps.length === 0) return;

    const el = containerRef.current;
    const width = el.clientWidth || 600;
    const height = Math.max(120, el.parentElement?.clientHeight - 20 || 200);

    // Build uPlot data: [timestamps, driver1_values, driver2_values, ...]
    const data = [timestamps];
    const uSeries = [{ label: 'Time' }];

    for (let i = 0; i < driverIds.length; i++) {
      const dId = driverIds[i];
      const channelData = seriesData[dId];
      if (channelData) {
        data.push(channelData[chartDef.key]);
      } else {
        data.push(new Float64Array(timestamps.length)); // zeros
      }
      uSeries.push({
        label: dId,
        stroke: driverColors[i],
        width: 1.5,
        value: (u, v) => v != null ? chartDef.fmt(v) : '--',
      });
    }

    const opts = {
      width,
      height,
      cursor: {
        sync: { key: syncKey },
        x: true,
        y: false,
      },
      scales: {
        x: { time: false },
        y: chartDef.scale ? { min: chartDef.scale[0], max: chartDef.scale[1] } : { auto: true },
      },
      axes: [
        {
          stroke: '#444',
          grid: { stroke: '#1a1a1a', width: 1 },
          ticks: { stroke: '#1a1a1a', width: 1 },
          values: (u, vals) => vals.map((v) => formatSessionTime(v)),
          font: '10px -apple-system, sans-serif',
          size: 28,
        },
        {
          stroke: '#444',
          grid: { stroke: '#1a1a1a', width: 1 },
          ticks: { stroke: '#1a1a1a', width: 1 },
          values: (u, vals) => vals.map((v) => chartDef.fmt(v)),
          font: '10px -apple-system, sans-serif',
          size: 44,
        },
      ],
      series: uSeries,
      legend: { show: false },
    };

    if (plotRef.current) {
      plotRef.current.destroy();
    }
    plotRef.current = new uPlot(opts, data, el);

    const observer = new ResizeObserver(() => {
      if (plotRef.current && el.clientWidth > 0) {
        const newH = Math.max(120, el.parentElement?.clientHeight - 20 || 200);
        plotRef.current.setSize({ width: el.clientWidth, height: newH });
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (plotRef.current) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
    };
  }, [timestamps, driverIds, seriesData, chartDef, driverColors, syncKey]);

  return <div ref={containerRef} />;
}

export function TelemetryOverlay({ incidentData, drivers }) {
  // Stable sync key so all charts share the same cursor
  const syncKey = useRef('steward-sync').current;

  const chartData = useMemo(() => {
    if (!incidentData?.frames) return null;
    return buildChartData(incidentData.frames, incidentData.driverIds || []);
  }, [incidentData]);

  const driverIds = incidentData?.driverIds || [];
  const driverColors = driverIds.map((_, i) => DRIVER_COLORS[i % DRIVER_COLORS.length]);

  if (!incidentData) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.title}>Telemetry Overlay</span>
        </div>
        <div style={styles.body}>
          <div>
            <p>Select an incident and click Review to load telemetry data.</p>
            <p style={{ marginTop: '8px', color: '#333', fontSize: '11px' }}>
              Stacked throttle / brake / speed / steer charts will appear here,
              synced to sessionTime with a shared cursor.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { centerSessionTime, windowSeconds } = incidentData;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Telemetry Overlay</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={styles.legend}>
            {driverIds.map((id, i) => (
              <div key={id} style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: driverColors[i] }} />
                <span style={{ color: driverColors[i] }}>
                  {drivers[id]?.name || id}
                </span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: '11px', color: '#888', fontVariantNumeric: 'tabular-nums' }}>
            {formatSessionTime(centerSessionTime)} ± {windowSeconds / 2}s
          </span>
        </div>
      </div>

      {!chartData || chartData.timestamps.length === 0 ? (
        <div style={styles.body}>
          <p>No frame data available in this time window.</p>
        </div>
      ) : (
        <div style={styles.chartsWrap}>
          {CHARTS.map((chartDef) => (
            <div key={chartDef.key} style={styles.chartSection}>
              <div style={styles.chartLabel}>{chartDef.label}</div>
              <TelemetryChart
                chartDef={chartDef}
                timestamps={chartData.timestamps}
                driverIds={driverIds}
                seriesData={chartData.series}
                driverColors={driverColors}
                syncKey={syncKey}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
