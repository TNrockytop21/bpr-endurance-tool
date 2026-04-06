import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const PROFILES_DIR = join(process.cwd(), 'data', 'profiles');

export function ensureProfilesDir() {
  mkdirSync(PROFILES_DIR, { recursive: true });
}

function sanitize(str) {
  return String(str).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
}

function profilePath(driverName, trackId) {
  return join(PROFILES_DIR, `${sanitize(driverName)}_${sanitize(trackId)}.json`);
}

export function saveProfile(driverName, trackId, trackName, bestLapTime, bestLapTrace, bestSectors) {
  const profile = {
    driverName,
    trackId,
    trackName,
    bestLapTime,
    bestLapTrace,
    bestSectors,
    updatedAt: new Date().toISOString(),
  };
  try {
    writeFileSync(profilePath(driverName, trackId), JSON.stringify(profile));
    console.log(`[profile] saved ${driverName} @ ${trackName}: ${bestLapTime?.toFixed(3)}s`);
  } catch (err) {
    console.error(`[profile] save failed:`, err.message);
  }
  return profile;
}

export function loadProfile(driverName, trackId) {
  const path = profilePath(driverName, trackId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}
