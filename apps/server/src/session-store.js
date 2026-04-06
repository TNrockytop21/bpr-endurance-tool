import { saveProfile } from './profiles.js';

const NUM_DISTANCE_BINS = 1000;

class SessionStore {
  constructor() {
    this.sessionInfo = null;
    this.drivers = new Map();
    this.viewers = new Map();
    this.stints = [];
    this.trackShape = null;
    this.eventLog = [];
    this._eventId = 0;
  }

  setSessionInfo(info) {
    this.sessionInfo = info;
  }

  addDriver(id, { name, car }) {
    this.drivers.set(id, {
      id,
      name,
      car,
      connected: true,
      lastFrame: null,
      currentLapNumber: null,
      currentLapSamples: [],
      laps: new Map(),
      bestLapTime: null,
      bestLapNumber: null,
      bestSectors: [null, null, null],
      stintStartTime: Date.now(),
      stintStartLap: null,
    });
  }

  removeDriver(id) {
    const driver = this.drivers.get(id);
    if (!driver) return null;
    const stint = this._finalizeStint(driver);
    driver.connected = false;
    return stint;
  }

  _finalizeStint(driver) {
    const stintLaps = [];
    for (const [, lap] of driver.laps) {
      if (lap.timestamp >= driver.stintStartTime) stintLaps.push(lap);
    }
    const validLaps = stintLaps.filter((l) => l.valid);
    const stint = {
      id: `stint-${this.stints.length + 1}`,
      driverId: driver.id,
      driverName: driver.name,
      car: driver.car,
      startTime: driver.stintStartTime,
      endTime: Date.now(),
      lapCount: stintLaps.length,
      avgLapTime: validLaps.length > 0
        ? validLaps.reduce((s, l) => s + l.lapTime, 0) / validLaps.length
        : null,
      bestLapTime: validLaps.length > 0
        ? Math.min(...validLaps.map((l) => l.lapTime))
        : null,
      totalFuelUsed: stintLaps.reduce((s, l) => s + l.fuelUsed, 0),
    };
    this.stints.push(stint);
    return stint;
  }

  getStints() {
    return this.stints;
  }

  addEvent(type, data) {
    const event = { id: ++this._eventId, type, timestamp: Date.now(), data };
    this.eventLog.push(event);
    if (this.eventLog.length > 200) this.eventLog.shift();
    return event;
  }

  getEventLog() {
    return this.eventLog;
  }

  updateFrame(driverId, frame) {
    const driver = this.drivers.get(driverId);
    if (!driver) return null;

    driver.lastFrame = frame;
    if (driver.stintStartLap === null) driver.stintStartLap = frame.lap;

    const prevLap = driver.currentLapNumber;
    const newLap = frame.lap;
    let completedLap = null;

    if (prevLap !== null && newLap > prevLap && driver.currentLapSamples.length > 0) {
      completedLap = this._finalizeLap(driver, prevLap);
    }

    driver.currentLapNumber = newLap;
    driver.currentLapSamples.push({ ...frame });

    return completedLap;
  }

  _computeSectors(samples) {
    const boundaries = [1 / 3, 2 / 3];
    const sectorTimes = [];
    let prevTime = 0;

    for (const boundary of boundaries) {
      // Find sample closest to boundary distance
      let closest = samples[0];
      let closestDiff = Math.abs(samples[0].lapDist - boundary);
      for (const s of samples) {
        const diff = Math.abs(s.lapDist - boundary);
        if (diff < closestDiff) {
          closest = s;
          closestDiff = diff;
        }
      }
      sectorTimes.push(Math.max(0, closest.lapTime - prevTime));
      prevTime = closest.lapTime;
    }
    // S3 = total - time at 66.6%
    sectorTimes.push(Math.max(0, samples[samples.length - 1].lapTime - prevTime));
    return sectorTimes;
  }

  _finalizeLap(driver, lapNumber) {
    const samples = driver.currentLapSamples;
    if (samples.length < 10) {
      driver.currentLapSamples = [];
      return null;
    }

    const lapTime = samples[samples.length - 1].lapTime;
    const fuelStart = samples[0].fuel;
    const fuelEnd = samples[samples.length - 1].fuel;
    const fuelUsed = fuelStart - fuelEnd;
    const hadPit = samples.some((s) => s.onPitRoad);

    const trace = this._binByDistance(samples);
    const sectors = this._computeSectors(samples);

    const lapRecord = {
      lapNumber,
      lapTime,
      fuelUsed: Math.max(0, fuelUsed),
      valid: !hadPit && lapTime > 0,
      timestamp: Date.now(),
      trace,
      sectors,
    };

    driver.laps.set(lapNumber, lapRecord);

    if (lapRecord.valid && (driver.bestLapTime === null || lapTime < driver.bestLapTime)) {
      driver.bestLapTime = lapTime;
      driver.bestLapNumber = lapNumber;
      // Save profile
      if (this.sessionInfo?.trackId) {
        saveProfile(
          driver.name,
          this.sessionInfo.trackId,
          this.sessionInfo.trackName,
          lapTime,
          trace,
          sectors
        );
      }
    }

    // Update best sectors
    if (lapRecord.valid) {
      for (let i = 0; i < 3; i++) {
        if (driver.bestSectors[i] === null || sectors[i] < driver.bestSectors[i]) {
          driver.bestSectors[i] = sectors[i];
        }
      }
    }

    // Generate track shape from first valid lap
    if (this.trackShape === null && lapRecord.valid) {
      this.trackShape = this._generateTrackShape(trace);
    }

    driver.currentLapSamples = [];
    return lapRecord;
  }

  _generateTrackShape(trace) {
    const points = [];
    let heading = 0;
    let x = 0;
    let y = 0;
    const n = trace.length;

    for (let i = 0; i < n; i++) {
      const speed = Math.max(trace[i].speed, 5);
      const latG = trace[i].latG || 0;
      const dHeading = (latG / speed) * (1 / n) * 50;
      heading += dHeading;
      x += Math.cos(heading) / n;
      y += Math.sin(heading) / n;
      points.push({ x, y });
    }

    // Close the loop
    const lastX = points[n - 1].x;
    const lastY = points[n - 1].y;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / n;
      points[i].x -= lastX * t;
      points[i].y -= lastY * t;
    }

    // Normalize to 0-1
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    for (const p of points) {
      p.x = (p.x - minX) / rangeX;
      p.y = (p.y - minY) / rangeY;
    }

    // Downsample to 200 points
    const step = Math.max(1, Math.floor(n / 200));
    return points.filter((_, i) => i % step === 0);
  }

  _binByDistance(samples) {
    const bins = new Array(NUM_DISTANCE_BINS);
    const channels = ['throttle', 'brake', 'speed', 'gear', 'steer', 'rpm', 'latG', 'lonG'];

    for (let i = 0; i < NUM_DISTANCE_BINS; i++) {
      bins[i] = {};
      for (const ch of channels) bins[i][ch] = 0;
      bins[i]._count = 0;
    }

    for (const s of samples) {
      const idx = Math.min(Math.floor(s.lapDist * NUM_DISTANCE_BINS), NUM_DISTANCE_BINS - 1);
      for (const ch of channels) {
        if (s[ch] !== undefined) bins[idx][ch] += s[ch];
      }
      bins[idx]._count++;
    }

    for (let i = 0; i < NUM_DISTANCE_BINS; i++) {
      if (bins[i]._count > 0) {
        for (const ch of channels) bins[i][ch] /= bins[i]._count;
      }
      delete bins[i]._count;
    }

    for (const ch of channels) {
      let lastFilled = -1;
      for (let i = 0; i < NUM_DISTANCE_BINS; i++) {
        if (bins[i][ch] !== 0 || (i > 0 && bins[i]._count !== undefined)) {
          if (lastFilled >= 0 && i - lastFilled > 1) {
            const startVal = bins[lastFilled][ch];
            const endVal = bins[i][ch];
            for (let j = lastFilled + 1; j < i; j++) {
              const t = (j - lastFilled) / (i - lastFilled);
              bins[j][ch] = startVal + t * (endVal - startVal);
            }
          }
          lastFilled = i;
        }
      }
    }

    return bins;
  }

  getDriverSummary(driverId) {
    const d = this.drivers.get(driverId);
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      car: d.car,
      connected: d.connected,
      bestLapTime: d.bestLapTime,
      bestLapNumber: d.bestLapNumber,
      bestSectors: d.bestSectors,
      lapCount: d.laps.size,
    };
  }

  getSnapshot() {
    const drivers = [];
    for (const d of this.drivers.values()) {
      drivers.push(this.getDriverSummary(d.id));
    }
    return {
      sessionInfo: this.sessionInfo,
      drivers,
      trackShape: this.trackShape,
    };
  }

  getLapList(driverId) {
    const driver = this.drivers.get(driverId);
    if (!driver) return [];
    const list = [];
    for (const [num, lap] of driver.laps) {
      list.push({
        lapNumber: num,
        lapTime: lap.lapTime,
        fuelUsed: lap.fuelUsed,
        valid: lap.valid,
        timestamp: lap.timestamp,
        sectors: lap.sectors,
      });
    }
    return list.sort((a, b) => a.lapNumber - b.lapNumber);
  }

  getLapTrace(driverId, lapNumber) {
    const driver = this.drivers.get(driverId);
    if (!driver) return null;
    const lap = driver.laps.get(lapNumber);
    if (!lap) return null;
    return lap.trace;
  }

  addViewer(ws) {
    this.viewers.set(ws, { subscribedDrivers: new Set() });
  }

  removeViewer(ws) {
    this.viewers.delete(ws);
  }

  setViewerSubscriptions(ws, driverIds) {
    const viewer = this.viewers.get(ws);
    if (!viewer) return;
    viewer.subscribedDrivers = new Set(driverIds);
  }

  subscribeAll(ws) {
    const viewer = this.viewers.get(ws);
    if (!viewer) return;
    viewer.subscribedDrivers = new Set(this.drivers.keys());
  }

  getSubscribedViewers(driverId) {
    const result = [];
    for (const [ws, viewer] of this.viewers) {
      if (viewer.subscribedDrivers.has(driverId)) {
        result.push(ws);
      }
    }
    return result;
  }

  getAllViewers() {
    return [...this.viewers.keys()];
  }
}

class TeamManager {
  constructor() {
    this.teams = new Map();
  }

  getOrCreate(teamName) {
    const name = teamName || 'Team A';
    if (!this.teams.has(name)) {
      this.teams.set(name, new SessionStore());
      console.log(`[team] created: ${name}`);
    }
    return this.teams.get(name);
  }

  getTeamList() {
    return [...this.teams.keys()];
  }
}

export const teamManager = new TeamManager();

// Backwards compat: default store for single-team usage
export const store = teamManager.getOrCreate('Team A');
