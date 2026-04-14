import { mkdirSync, createWriteStream, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SESSIONS_DIR = join(process.cwd(), 'data', 'sessions');

export function ensureSessionsDir() {
  mkdirSync(SESSIONS_DIR, { recursive: true });
}

/**
 * SessionRecorder — appends telemetry frames and events to a per-session
 * NDJSON file on disk. One line per record, each tagged with a type.
 *
 * File format (each line is a JSON object):
 *   {"t":"session","ts":1713045600000,"trackName":"Sebring","trackId":237,...}
 *   {"t":"driver","ts":1713045601000,"driverId":"driver-agent-1","name":"J.Smith","car":"GT3 R"}
 *   {"t":"frame","ts":1713045601050,"d":"driver-agent-1","st":3245.5,"data":{...}}
 *   {"t":"lap","ts":1713045720000,"d":"driver-agent-1","ln":5,"lt":121.45,...}
 *   {"t":"incident","ts":1713045800000,"d":"driver-agent-1","delta":2,"total":4,...}
 *   {"t":"penalty","ts":1713045900000,"d":"driver-agent-1","type":"drive-through",...}
 *   {"t":"event","ts":1713046000000,"type":"driver_left","data":{...}}
 *
 * Keys are abbreviated to minimize disk usage at 20Hz write rate:
 *   t = record type, ts = wall-clock timestamp, d = driverId,
 *   st = sessionTime, ln = lapNumber, lt = lapTime
 */
class SessionRecorder {
  constructor() {
    this._stream = null;
    this._sessionId = null;
    this._filename = null;
    this._frameCount = 0;
  }

  /**
   * Start recording a new session. Creates the NDJSON file.
   * Called when the first agent connects or session info arrives.
   */
  start(sessionInfo) {
    if (this._stream) return; // already recording

    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const trackName = (sessionInfo?.trackName || 'unknown')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 40);

    this._sessionId = `${dateStr}_${trackName}`;
    this._filename = `${this._sessionId}.ndjson`;
    this._frameCount = 0;

    const filePath = join(SESSIONS_DIR, this._filename);
    this._stream = createWriteStream(filePath, { flags: 'a' });

    // Write session header
    this._write({
      t: 'session',
      ts: Date.now(),
      sessionId: this._sessionId,
      ...sessionInfo,
    });

    console.log(`[recorder] started: ${this._filename}`);
  }

  /** Stop recording and close the file stream. */
  stop() {
    if (!this._stream) return;
    console.log(`[recorder] stopped: ${this._filename} (${this._frameCount} frames)`);
    this._stream.end();
    this._stream = null;
    this._sessionId = null;
    this._filename = null;
  }

  get active() {
    return this._stream !== null;
  }

  get sessionId() {
    return this._sessionId;
  }

  /** Record a driver joining the session. */
  recordDriver(driverId, name, car) {
    this._write({ t: 'driver', ts: Date.now(), d: driverId, name, car });
  }

  /** Record a telemetry frame. */
  recordFrame(driverId, frame) {
    this._frameCount++;
    this._write({
      t: 'frame',
      ts: Date.now(),
      d: driverId,
      st: frame.sessionTime,
      data: frame,
    });
  }

  /** Record a completed lap. */
  recordLap(driverId, lap) {
    this._write({
      t: 'lap',
      ts: Date.now(),
      d: driverId,
      ln: lap.lapNumber,
      lt: lap.lapTime,
      fuel: lap.fuelUsed,
      valid: lap.valid,
      sectors: lap.sectors,
    });
  }

  /** Record an auto-detected incident. */
  recordIncident(incidentDelta) {
    this._write({
      t: 'incident',
      ts: Date.now(),
      d: incidentDelta.driverId,
      delta: incidentDelta.delta,
      total: incidentDelta.newCount,
      st: incidentDelta.sessionTime,
      lap: incidentDelta.lap,
    });
  }

  /** Record a penalty issued by a steward. */
  recordPenalty(driverId, penaltyType, timeSeconds, notes) {
    this._write({
      t: 'penalty',
      ts: Date.now(),
      d: driverId,
      type: penaltyType,
      timeSec: timeSeconds || null,
      notes: notes || null,
    });
  }

  /** Record a generic event. */
  recordEvent(event) {
    this._write({ t: 'event', ts: Date.now(), ...event });
  }

  /** Record a driver disconnecting. */
  recordDriverLeft(driverId, driverName) {
    this._write({ t: 'driver_left', ts: Date.now(), d: driverId, name: driverName });
  }

  /** Write one NDJSON line to the stream. */
  _write(obj) {
    if (!this._stream) return;
    this._stream.write(JSON.stringify(obj) + '\n');
  }

  /** List all recorded session files. */
  static listSessions() {
    try {
      return readdirSync(SESSIONS_DIR)
        .filter((f) => f.endsWith('.ndjson'))
        .map((f) => {
          const filePath = join(SESSIONS_DIR, f);
          const stat = statSync(filePath);
          return {
            filename: f,
            sessionId: f.replace('.ndjson', ''),
            size: stat.size,
            created: stat.birthtime,
          };
        })
        .sort((a, b) => b.created - a.created);
    } catch {
      return [];
    }
  }

  /** Read the header (first line) of a session file. */
  static getSessionHeader(sessionId) {
    try {
      const filePath = join(SESSIONS_DIR, `${sessionId}.ndjson`);
      const data = readFileSync(filePath, 'utf-8');
      const firstLine = data.split('\n')[0];
      return JSON.parse(firstLine);
    } catch {
      return null;
    }
  }
}

export const recorder = new SessionRecorder();
