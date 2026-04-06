const STORAGE_KEY = 'bpr_profiles';

function getAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function getCachedProfile(driverName, trackId) {
  if (!driverName || !trackId) return null;
  const key = `${driverName}_${trackId}`;
  return getAll()[key] || null;
}

export function setCachedProfile(driverName, trackId, profile) {
  if (!driverName || !trackId) return;
  const key = `${driverName}_${trackId}`;
  const all = getAll();
  all[key] = profile;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage full - ignore
  }
}
