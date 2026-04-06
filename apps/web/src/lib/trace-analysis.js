/**
 * Find speed extremes (local min/max) in a lap trace.
 * Returns { maxPoints, minPoints } with bin index and speed value.
 */
export function findSpeedExtremes(trace) {
  if (!trace || trace.length < 20) return { maxPoints: [], minPoints: [] };

  const speeds = trace.map((b) => b.speed || 0);
  const n = speeds.length;

  // Smooth with a 10-bin moving average to reduce noise
  const smoothed = new Array(n);
  const window = 10;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - window); j <= Math.min(n - 1, i + window); j++) {
      sum += speeds[j];
      count++;
    }
    smoothed[i] = sum / count;
  }

  const maxPoints = [];
  const minPoints = [];
  const threshold = 0.15; // 15% change required

  // Find local maxima and minima
  for (let i = 20; i < n - 20; i++) {
    const prev = smoothed[i - 15];
    const curr = smoothed[i];
    const next = smoothed[i + 15];

    // Local maximum (end of straight)
    if (curr > prev && curr > next && curr > prev * (1 + threshold)) {
      // Check it's actually a peak (no higher value nearby)
      let isPeak = true;
      for (let j = i - 10; j <= i + 10; j++) {
        if (j !== i && smoothed[j] > curr) { isPeak = false; break; }
      }
      if (isPeak) {
        maxPoints.push({ bin: i, speed: speeds[i], pct: ((i / n) * 100).toFixed(1) });
      }
    }

    // Local minimum (braking zone exit / apex)
    if (curr < prev && curr < next && curr < prev * (1 - threshold)) {
      let isTrough = true;
      for (let j = i - 10; j <= i + 10; j++) {
        if (j !== i && smoothed[j] < curr) { isTrough = false; break; }
      }
      if (isTrough) {
        minPoints.push({ bin: i, speed: speeds[i], pct: ((i / n) * 100).toFixed(1) });
      }
    }
  }

  return { maxPoints, minPoints };
}

/**
 * Match speed extremes between two traces by proximity (within 30 bins).
 * Returns matched pairs with deltas.
 */
export function matchExtremes(extremes1, extremes2) {
  const matched = [];
  const tolerance = 30;

  for (const p1 of extremes1.maxPoints) {
    const match = extremes2.maxPoints.find((p2) => Math.abs(p1.bin - p2.bin) < tolerance);
    if (match) {
      matched.push({
        type: 'max',
        bin: p1.bin,
        pct: p1.pct,
        speed1: p1.speed,
        speed2: match.speed,
        delta: match.speed - p1.speed,
      });
    }
  }

  for (const p1 of extremes1.minPoints) {
    const match = extremes2.minPoints.find((p2) => Math.abs(p1.bin - p2.bin) < tolerance);
    if (match) {
      matched.push({
        type: 'min',
        bin: p1.bin,
        pct: p1.pct,
        speed1: p1.speed,
        speed2: match.speed,
        delta: match.speed - p1.speed,
      });
    }
  }

  return matched;
}

/**
 * Find braking points in a trace (where brake crosses above threshold).
 * Uses hysteresis to avoid re-triggering in the same braking zone.
 */
export function findBrakingPoints(trace, threshold = 0.5) {
  if (!trace || trace.length < 20) return [];
  const points = [];
  let armed = true;

  for (let i = 1; i < trace.length; i++) {
    const prev = trace[i - 1].brake || 0;
    const curr = trace[i].brake || 0;
    if (armed && prev < threshold && curr >= threshold) {
      points.push({ bin: i, pct: ((i / trace.length) * 100).toFixed(1) });
      armed = false;
    }
    if (!armed && curr < threshold * 0.3) {
      armed = true;
    }
  }
  return points;
}

/**
 * Detect corners from a trace using speed minima.
 * Returns numbered corners with apex location.
 */
export function detectCorners(trace) {
  const { minPoints } = findSpeedExtremes(trace);
  return minPoints.map((p, i) => ({
    number: i + 1,
    apexBin: p.bin,
    minSpeed: p.speed,
    pct: p.pct,
  }));
}

/**
 * Estimate time loss per corner between two traces.
 * Uses 1/speed integration for time approximation.
 */
export function cornerTimeLoss(lapTrace, bestTrace, corners) {
  if (!lapTrace || !bestTrace || !corners || corners.length === 0) return [];
  const n = lapTrace.length;

  // Compute cumulative time for both traces
  function cumulativeTime(trace) {
    const times = [0];
    for (let i = 1; i < trace.length; i++) {
      const speed = Math.max(trace[i].speed, 1);
      times.push(times[i - 1] + 1 / speed);
    }
    return times;
  }

  const lapTimes = cumulativeTime(lapTrace);
  const bestTimes = cumulativeTime(bestTrace);

  // Compute segment times between corners
  const results = [];
  const boundaries = [0, ...corners.map((c) => c.apexBin), n - 1];

  for (let i = 0; i < corners.length; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 2] || n - 1;
    const lapSegTime = lapTimes[end] - lapTimes[start];
    const bestSegTime = bestTimes[end] - bestTimes[start];
    const delta = lapSegTime - bestSegTime;
    // Normalize to approximate seconds (scale factor based on total time ratio)
    const totalLapTime = lapTimes[n - 1];
    const totalBestTime = bestTimes[n - 1];
    const scaledDelta = totalLapTime > 0 ? delta / totalLapTime * 100 : 0; // relative %

    results.push({
      ...corners[i],
      delta: scaledDelta,
    });
  }
  return results;
}

/**
 * Compute speed variance (coefficient of variation) across multiple traces at each distance bin.
 */
export function computeSpeedVariance(traces) {
  if (!traces || traces.length < 2) return [];
  const n = traces[0].length;
  const result = [];

  for (let i = 0; i < n; i++) {
    const speeds = traces.map((t) => t[i]?.speed || 0).filter((s) => s > 0);
    if (speeds.length < 2) {
      result.push({ bin: i, cv: 0 });
      continue;
    }
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance = speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length;
    const stddev = Math.sqrt(variance);
    result.push({ bin: i, cv: mean > 0 ? stddev / mean : 0 });
  }
  return result;
}
