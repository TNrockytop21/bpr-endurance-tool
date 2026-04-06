import { store as defaultStore, teamManager } from './session-store.js';

function send(ws, type, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

export function broadcastToViewers(type, payload, driverId, store) {
  const s = store || defaultStore;
  const viewers = driverId
    ? s.getSubscribedViewers(driverId)
    : s.getAllViewers();

  for (const ws of viewers) {
    send(ws, type, payload);
  }
}

export function sendToViewer(ws, type, payload) {
  send(ws, type, payload);
}

export function broadcastToAllViewers(type, payload) {
  for (const teamName of teamManager.getTeamList()) {
    const store = teamManager.getOrCreate(teamName);
    for (const ws of store.getAllViewers()) {
      send(ws, type, payload);
    }
  }
}
