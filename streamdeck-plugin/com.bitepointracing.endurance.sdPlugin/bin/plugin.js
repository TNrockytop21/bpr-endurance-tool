/// BPR Endurance Tool - Stream Deck Plugin
/// Communicates with the BPR telemetry server via HTTP POST

const http = require('http');
const https = require('https');

// Default server URL - configurable via global settings
let serverUrl = 'http://45.55.216.21';

// ── API Helper ───────────────────────────────────────

function sendCommand(command) {
  const url = new URL('/api/streamdeck', serverUrl);
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;

  const postData = JSON.stringify(command);
  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
    timeout: 3000,
  };

  const req = client.request(options, (res) => {
    res.resume(); // consume response
  });
  req.on('error', () => {}); // silently ignore errors
  req.write(postData);
  req.end();
}

// ── Stream Deck WebSocket Connection ─────────────────

let ws;
const actions = {};
let zoomLevel = 100;
const teamList = ['Team A', 'Team B', 'Team C'];
let currentTeamIdx = 0;

const PAGES = [
  { path: '/', label: 'Live' },
  { path: '/fuel', label: 'Fuel' },
  { path: '/stints', label: 'Stints' },
  { path: '/standings', label: 'Standings' },
  { path: '/grid', label: 'Grid' },
  { path: '/compare', label: 'Compare' },
  { path: '/coaching', label: 'Coaching' },
];

function connectToStreamDeck(port, pluginUUID, registerEvent) {
  ws = new (require('ws'))(`ws://127.0.0.1:${port}`);

  ws.on('open', () => {
    ws.send(JSON.stringify({ event: registerEvent, uuid: pluginUUID }));
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    handleMessage(msg);
  });

  ws.on('close', () => {
    setTimeout(() => connectToStreamDeck(port, pluginUUID, registerEvent), 3000);
  });
}

function handleMessage(msg) {
  const { event, action, context, payload } = msg;

  switch (event) {
    case 'keyDown':
      handleKeyDown(action, context, payload);
      break;
    case 'dialRotate':
      handleDialRotate(action, context, payload);
      break;
    case 'dialDown':
      handleDialDown(action, context, payload);
      break;
    case 'willAppear':
      actions[context] = { action, settings: payload?.settings || {} };
      handleWillAppear(action, context, payload);
      break;
    case 'willDisappear':
      delete actions[context];
      break;
    case 'didReceiveSettings':
      if (actions[context]) actions[context].settings = payload?.settings || {};
      break;
    case 'didReceiveGlobalSettings':
      if (payload?.settings?.serverUrl) {
        serverUrl = payload.settings.serverUrl;
      }
      break;
  }
}

// ── Button Handlers ──────────────────────────────────

function handleKeyDown(action, context, payload) {
  const settings = payload?.settings || {};

  switch (action) {
    case 'com.bitepointracing.switch-page': {
      const page = settings.page || '/';
      sendCommand({ action: 'navigate', page });
      break;
    }
    case 'com.bitepointracing.toggle-action': {
      const toggleAction = settings.toggleAction || 'toggleGhost';
      sendCommand({ action: toggleAction });
      break;
    }
  }
}

function handleWillAppear(action, context, payload) {
  const settings = payload?.settings || {};

  if (action === 'com.bitepointracing.switch-page') {
    const page = settings.page || '/';
    const pageInfo = PAGES.find((p) => p.path === page);
    if (pageInfo) {
      setTitle(context, pageInfo.label);
    }
  }

  if (action === 'com.bitepointracing.toggle-action') {
    const labels = {
      toggleGhost: 'Ghost',
      fullscreen: 'Full\nScreen',
    };
    setTitle(context, labels[settings.toggleAction] || 'Action');
  }
}

// ── Dial Handlers ────────────────────────────────────

function handleDialRotate(action, context, payload) {
  const ticks = payload?.ticks || 0;

  switch (action) {
    case 'com.bitepointracing.zoom-telemetry': {
      zoomLevel = Math.max(25, Math.min(400, zoomLevel + ticks * 10));
      sendCommand({ action: 'zoom', target: 'telemetry', ticks, zoomLevel });
      setFeedback(context, {
        title: 'Zoom',
        value: `${zoomLevel}%`,
        indicator: { value: Math.round(((zoomLevel - 25) / 375) * 100) },
      });
      break;
    }
    case 'com.bitepointracing.scroll-page': {
      sendCommand({ action: 'scroll', ticks });
      setFeedback(context, {
        title: 'Scroll',
        value: ticks > 0 ? 'Down' : 'Up',
      });
      break;
    }
    case 'com.bitepointracing.team-switcher': {
      currentTeamIdx = (currentTeamIdx + ticks + teamList.length * 100) % teamList.length;
      setFeedback(context, {
        title: 'Team',
        value: teamList[currentTeamIdx],
        indicator: { value: Math.round((currentTeamIdx / (teamList.length - 1)) * 100) },
      });
      break;
    }
  }
}

function handleDialDown(action, context, payload) {
  switch (action) {
    case 'com.bitepointracing.zoom-telemetry': {
      zoomLevel = 100;
      sendCommand({ action: 'zoom', target: 'telemetry', ticks: 0, zoomLevel: 100 });
      setFeedback(context, {
        title: 'Zoom',
        value: '100%',
        indicator: { value: 20 },
      });
      break;
    }
    case 'com.bitepointracing.scroll-page': {
      sendCommand({ action: 'scroll', ticks: 0, scrollToTop: true });
      break;
    }
    case 'com.bitepointracing.team-switcher': {
      sendCommand({ action: 'switchTeam', team: teamList[currentTeamIdx] });
      setFeedback(context, {
        title: 'Switched!',
        value: teamList[currentTeamIdx],
      });
      break;
    }
  }
}

// ── Stream Deck API Helpers ──────────────────────────

function setTitle(context, title) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    event: 'setTitle',
    context,
    payload: { title, target: 0 },
  }));
}

function setFeedback(context, feedback) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    event: 'setFeedback',
    context,
    payload: feedback,
  }));
}

// ── Plugin Entry Point ───────────────────────────────

// Stream Deck passes connection info via command line args
const args = {};
process.argv.forEach((val, idx) => {
  if (val.startsWith('-')) {
    args[val] = process.argv[idx + 1];
  }
});

const port = args['-port'];
const pluginUUID = args['-pluginUUID'];
const registerEvent = args['-registerEvent'];
const info = args['-info'];

if (port && pluginUUID && registerEvent) {
  connectToStreamDeck(port, pluginUUID, registerEvent);

  // Request global settings on startup
  setTimeout(() => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        event: 'getGlobalSettings',
        context: pluginUUID,
      }));
    }
  }, 1000);
}
