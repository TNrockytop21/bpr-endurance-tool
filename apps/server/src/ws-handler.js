import { teamManager } from './session-store.js';
import { broadcastToViewers, sendToViewer } from './broadcast.js';
import { MSG } from './protocol.js';
import { loadProfile } from './profiles.js';
import { savePlan, loadPlan, listPlans, deletePlan } from './race-plans.js';

let agentCounter = 0;

function parseTeam(url) {
  try {
    const params = new URL('http://x' + url).searchParams;
    return decodeURIComponent(params.get('team') || 'Team A');
  } catch {
    return 'Team A';
  }
}

export function handleAgentConnection(ws, req) {
  const agentId = `agent-${++agentCounter}`;
  const teamName = parseTeam(req.url);
  const store = teamManager.getOrCreate(teamName);
  let driverId = null;

  console.log(`[agent] connected: ${agentId} → ${teamName}`);

  // Notify all viewers that team list may have changed
  broadcastTeamList();

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const { type, payload } = msg;

    switch (type) {
      case MSG.AGENT_HELLO: {
        driverId = `driver-${agentId}`;
        store.addDriver(driverId, {
          name: payload.driverName || 'Unknown',
          car: payload.car || 'Unknown',
        });
        if (payload.trackName) {
          store.setSessionInfo({
            trackName: payload.trackName,
            trackId: payload.trackId,
            trackLength: payload.trackLength,
          });
        }
        for (const viewerWs of store.getAllViewers()) {
          const viewer = store.viewers.get(viewerWs);
          if (viewer) viewer.subscribedDrivers.add(driverId);
        }
        broadcastToViewers(MSG.DRIVER_JOINED, {
          driverId,
          driverName: payload.driverName,
          car: payload.car,
        }, null, store);
        const joinEvent = store.addEvent('driver_joined', { driverName: payload.driverName, car: payload.car });
        broadcastToViewers(MSG.EVENT, joinEvent, null, store);

        if (store.sessionInfo?.trackId) {
          const profile = loadProfile(payload.driverName, store.sessionInfo.trackId);
          if (profile) {
            broadcastToViewers(MSG.PROFILE, { driverId, profile }, null, store);
          }
        }
        console.log(`[agent] ${teamName}: ${payload.driverName} (${driverId})`);
        break;
      }

      case MSG.AGENT_FRAME: {
        if (!driverId) return;
        const trackShapeBefore = store.trackShape;
        const completedLap = store.updateFrame(driverId, payload);

        broadcastToViewers(MSG.TELEMETRY_FRAME, { driverId, ...payload }, driverId, store);

        if (completedLap) {
          const driver = store.drivers.get(driverId);

          broadcastToViewers(MSG.LAP_COMPLETE, {
            driverId,
            lapNumber: completedLap.lapNumber,
            lapTime: completedLap.lapTime,
            fuelUsed: completedLap.fuelUsed,
            valid: completedLap.valid,
            sectors: completedLap.sectors,
            bestLap: driver?.bestLapTime,
            bestSectors: driver?.bestSectors,
          }, null, store);

          if (completedLap.valid && completedLap.lapTime === driver?.bestLapTime) {
            const bestEvent = store.addEvent('new_best_lap', {
              driverName: driver?.name,
              lapNumber: completedLap.lapNumber,
              lapTime: completedLap.lapTime,
            });
            broadcastToViewers(MSG.EVENT, bestEvent, null, store);
          }

          if (!trackShapeBefore && store.trackShape) {
            broadcastToViewers(MSG.TRACK_SHAPE, { points: store.trackShape }, null, store);
          }

          console.log(
            `[lap] ${teamName} ${driver?.name} L${completedLap.lapNumber}: ${completedLap.lapTime?.toFixed(3)}s`
          );
        }
        break;
      }

      case MSG.AGENT_SESSION_INFO: {
        store.setSessionInfo(payload);
        broadcastToViewers(MSG.SESSION_SNAPSHOT, store.getSnapshot(), null, store);
        break;
      }

      case MSG.AGENT_STANDINGS: {
        broadcastToViewers(MSG.STANDINGS, payload, null, store);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (driverId) {
      const driverName = store.drivers.get(driverId)?.name;
      const stint = store.removeDriver(driverId);
      broadcastToViewers(MSG.DRIVER_LEFT, { driverId }, null, store);
      if (stint) {
        broadcastToViewers(MSG.STINT_COMPLETE, stint, null, store);
        const stintEvent = store.addEvent('stint_complete', {
          driverName: stint.driverName,
          lapCount: stint.lapCount,
          avgLapTime: stint.avgLapTime,
        });
        broadcastToViewers(MSG.EVENT, stintEvent, null, store);
      }
      const leftEvent = store.addEvent('driver_left', { driverName });
      broadcastToViewers(MSG.EVENT, leftEvent, null, store);
      console.log(`[agent] ${teamName}: ${driverName} disconnected`);
    }
  });
}

// Track which team each viewer is watching
const viewerTeams = new Map();

export function handleViewerConnection(ws, req) {
  const teamName = parseTeam(req.url);
  const store = teamManager.getOrCreate(teamName);

  store.addViewer(ws);
  store.subscribeAll(ws);
  viewerTeams.set(ws, teamName);

  // Send team list + current team's data
  sendToViewer(ws, MSG.TEAM_LIST, { teams: teamManager.getTeamList(), currentTeam: teamName });
  sendToViewer(ws, MSG.SESSION_SNAPSHOT, store.getSnapshot());

  const stints = store.getStints();
  if (stints.length > 0) sendToViewer(ws, MSG.STINT_LIST, { stints });
  const events = store.getEventLog();
  if (events.length > 0) sendToViewer(ws, MSG.EVENT_LOG, { events });
  sendToViewer(ws, MSG.PLAN_LIST, { plans: listPlans() });

  console.log(`[viewer] connected → ${teamName}`);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const { type, payload } = msg;
    const currentTeam = viewerTeams.get(ws) || 'Team A';
    const currentStore = teamManager.getOrCreate(currentTeam);

    switch (type) {
      case MSG.SWITCH_TEAM: {
        const newTeam = payload.team;
        const oldStore = currentStore;
        const newStore = teamManager.getOrCreate(newTeam);

        // Remove from old team's viewers
        oldStore.removeViewer(ws);

        // Add to new team's viewers
        newStore.addViewer(ws);
        newStore.subscribeAll(ws);
        viewerTeams.set(ws, newTeam);

        // Send new team's full state
        sendToViewer(ws, MSG.TEAM_LIST, { teams: teamManager.getTeamList(), currentTeam: newTeam });
        sendToViewer(ws, MSG.SESSION_SNAPSHOT, newStore.getSnapshot());
        const st = newStore.getStints();
        if (st.length > 0) sendToViewer(ws, MSG.STINT_LIST, { stints: st });
        const ev = newStore.getEventLog();
        if (ev.length > 0) sendToViewer(ws, MSG.EVENT_LOG, { events: ev });

        console.log(`[viewer] switched ${currentTeam} → ${newTeam}`);
        break;
      }

      case MSG.SUBSCRIBE:
        currentStore.setViewerSubscriptions(ws, payload.driverIds || []);
        break;

      case MSG.SUBSCRIBE_ALL:
        currentStore.subscribeAll(ws);
        break;

      case MSG.REQUEST_LAP_TRACE: {
        const trace = currentStore.getLapTrace(payload.driverId, payload.lapNumber);
        sendToViewer(ws, MSG.LAP_TRACE, {
          driverId: payload.driverId,
          lapNumber: payload.lapNumber,
          trace,
        });
        break;
      }

      case MSG.REQUEST_LAP_LIST: {
        const laps = currentStore.getLapList(payload.driverId);
        sendToViewer(ws, MSG.LAP_LIST, {
          driverId: payload.driverId,
          laps,
        });
        break;
      }

      case MSG.REQUEST_STINTS:
        sendToViewer(ws, MSG.STINT_LIST, { stints: currentStore.getStints() });
        break;

      case MSG.SAVE_PLAN: {
        const { eventName, teamName, plan } = payload;
        savePlan(eventName, teamName, plan);
        sendToViewer(ws, MSG.PLAN_LIST, { plans: listPlans() });
        break;
      }

      case MSG.LOAD_PLAN: {
        const plan = loadPlan(payload.eventName, payload.teamName);
        sendToViewer(ws, MSG.PLAN_DATA, { plan });
        break;
      }

      case MSG.DELETE_PLAN: {
        deletePlan(payload.eventName, payload.teamName);
        sendToViewer(ws, MSG.PLAN_LIST, { plans: listPlans() });
        break;
      }

      case MSG.LIST_PLANS:
        sendToViewer(ws, MSG.PLAN_LIST, { plans: listPlans() });
        break;
    }
  });

  ws.on('close', () => {
    const currentTeam = viewerTeams.get(ws) || 'Team A';
    teamManager.getOrCreate(currentTeam).removeViewer(ws);
    viewerTeams.delete(ws);
    console.log('[viewer] disconnected');
  });
}

function broadcastTeamList() {
  const teams = teamManager.getTeamList();
  for (const teamName of teams) {
    const store = teamManager.getOrCreate(teamName);
    for (const ws of store.getAllViewers()) {
      sendToViewer(ws, MSG.TEAM_LIST, { teams, currentTeam: teamName });
    }
  }
}
