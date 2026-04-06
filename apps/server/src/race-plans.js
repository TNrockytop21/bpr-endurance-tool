import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';

const PLANS_DIR = join(process.cwd(), 'data', 'race-plans');

export function ensurePlansDir() {
  mkdirSync(PLANS_DIR, { recursive: true });
}

function sanitize(str) {
  return String(str).replace(/[^a-zA-Z0-9 _-]/g, '').substring(0, 80).trim().replace(/\s+/g, '_');
}

function planPath(eventName, teamName) {
  return join(PLANS_DIR, `${sanitize(eventName)}__${sanitize(teamName)}.json`);
}

export function savePlan(eventName, teamName, planData) {
  const data = {
    ...planData,
    eventName,
    teamName,
    updatedAt: new Date().toISOString(),
  };
  try {
    writeFileSync(planPath(eventName, teamName), JSON.stringify(data, null, 2));
    console.log(`[plan] saved: ${eventName} (${teamName})`);
    return true;
  } catch (err) {
    console.error(`[plan] save failed:`, err.message);
    return false;
  }
}

export function loadPlan(eventName, teamName) {
  const path = planPath(eventName, teamName);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

export function listPlans() {
  if (!existsSync(PLANS_DIR)) return [];
  try {
    const files = readdirSync(PLANS_DIR).filter((f) => f.endsWith('.json'));
    return files.map((f) => {
      try {
        const data = JSON.parse(readFileSync(join(PLANS_DIR, f), 'utf-8'));
        const stat = statSync(join(PLANS_DIR, f));
        return {
          eventName: data.eventName || f.replace('.json', ''),
          teamName: data.teamName || 'Unknown',
          updatedAt: data.updatedAt || stat.mtime.toISOString(),
          raceLength: data.raceLength,
          driverCount: data.drivers?.length || 0,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

export function deletePlan(eventName, teamName) {
  const path = planPath(eventName, teamName);
  if (!existsSync(path)) return false;
  try {
    unlinkSync(path);
    console.log(`[plan] deleted: ${eventName} (${teamName})`);
    return true;
  } catch {
    return false;
  }
}
