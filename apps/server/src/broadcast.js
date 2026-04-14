import { store } from './session-store.js';

function send(ws, type, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

export function broadcastToViewers(type, payload, driverId) {
  const viewers = driverId
    ? store.getSubscribedViewers(driverId)
    : store.getAllViewers();

  for (const ws of viewers) {
    send(ws, type, payload);
  }
}

export function sendToViewer(ws, type, payload) {
  send(ws, type, payload);
}
