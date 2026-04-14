import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { handleAgentConnection, handleViewerConnection, handleStewardConnection } from './ws-handler.js';
import { ensureProfilesDir } from './profiles.js';
import { ensurePlansDir } from './race-plans.js';
import { ensureSessionsDir } from './session-recorder.js';

ensureProfilesDir();
ensurePlansDir();
ensureSessionsDir();

const PORT = process.env.PORT || 8080;
const app = express();
const server = createServer(app);

app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Stream Deck API endpoint
import { broadcastToViewers } from './broadcast.js';
app.post('/api/streamdeck', (req, res) => {
  broadcastToViewers('streamdeck:command', req.body);
  res.json({ ok: true });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = req.url || '';
  if (url.startsWith('/ws/agent')) {
    handleAgentConnection(ws, req);
  } else if (url.startsWith('/ws/steward')) {
    handleStewardConnection(ws, req);
  } else {
    handleViewerConnection(ws, req);
  }
});

server.listen(PORT, () => {
  console.log(`Telemetry server running on port ${PORT}`);
  console.log(`  Agent WebSocket:  ws://localhost:${PORT}/ws/agent`);
  console.log(`  Viewer WebSocket: ws://localhost:${PORT}/ws/viewer`);
  console.log(`  Steward WebSocket: ws://localhost:${PORT}/ws/steward`);
});
