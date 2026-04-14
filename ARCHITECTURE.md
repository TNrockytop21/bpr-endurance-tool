# BPR Race Control — Technical Architecture

This document describes the full system built for race control and stewarding of iRacing league events. It covers every component, how they connect, and what each piece does.

---

## System Overview

Three applications share one websocket-based data pipeline:

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  Driver PC  │     │  DigitalOcean    │     │  Steward PC       │
│             │     │  Droplet         │     │                   │
│  Agent      │────▶│  Server          │◀───▶│  Electron App     │
│  (Python)   │     │  (Node.js)       │     │  (React + iRSDK)  │
│             │◀────│                  │     │                   │
│  Overlay    │     │                  │────▶│                   │
└─────────────┘     │                  │     └───────────────────┘
                    │                  │
                    │                  │────▶┌───────────────────┐
                    │                  │     │  Broadcast Crew   │
                    └──────────────────┘     │  Web Dashboard    │
                                            │  (React/Vite)     │
                                            └───────────────────┘
```

**Data flows in two directions:**
- **Forward:** Agent → Server → Viewers/Stewards (telemetry, standings, events)
- **Reverse:** Steward → Server → Agent (penalties, investigation notices, race control messages)

---

## 1. Agent (`agent/`)

The agent runs on each driver's PC alongside iRacing. It reads telemetry from iRacing's shared memory via `pyirsdk` and streams it over a websocket to the server.

### Files

| File | Purpose |
|------|---------|
| `launcher.py` | Tkinter GUI — driver enters name, clicks Connect. Shows "Report Incident (F1)" button once connected. Displays penalty/RC message overlays. |
| `main.py` | CLI entry point with `--mock` flag for synthetic data. Contains `MockIRacing` class that generates realistic Sebring telemetry. |
| `capture.py` | Reads iRacing SDK: `read_frame()` (20Hz telemetry), `read_standings()` (2Hz leaderboard), `get_driver_info()`, `get_session_info()`. |
| `protocol.py` | Message constructors: `hello_message()`, `frame_message()`, `standings_message()`. |
| `config.py` | `SERVER_URL`, `SEND_RATE_HZ` (20), `CAPTURE_RATE_HZ` (60). |

### What the agent sends (every frame at 20Hz)

Core: `lap`, `lapDist`, `lapTime`, `throttle`, `brake`, `speed`, `rpm`, `gear`, `steer`, `latG`, `lonG`, `fuel`, `onPitRoad`, `position`, `sessionTime`, `sessionTimeRemain`.

Optional: tire temps/wear, brake temps, shock deflection, water/oil temp, oil pressure, voltage, fuel pressure, fuel use/hour, clutch, ABS, TC, air/track temp, wind, `incidents` (cumulative iRacing incident count), lap delta, last lap time.

### What the agent receives

| Message | What happens |
|---------|-------------|
| `server:penalty` | Transparent overlay banner appears over iRacing — color-coded by penalty type (red for DT/SG/time/DSQ, amber for warning, blue for race incident, green for no action). Fades after 8s. |
| `server:underInvestigation` | Amber overlay: "INCIDENT UNDER INVESTIGATION". Fades after 10s. |
| `server:message` | Race control message overlay (yellow flag, track limits, custom). Color auto-detected from message content. |
| `server:protestAck` | Confirmation overlay: "PROTEST RECEIVED — STEWARDS NOTIFIED". |

### Driver protest

Driver presses **F1** (or clicks "Report Incident" button). Agent sends `agent:protest` with current `sessionTime`, `lap`, `lapDist`. Server broadcasts to all stewards. Agent gets acknowledgment overlay. 10-second cooldown prevents spam.

---

## 2. Server (`apps/server/src/`)

Node.js + Express + ws. Single process on the droplet. Three websocket endpoints: `/ws/agent`, `/ws/viewer`, `/ws/steward`.

### Files

| File | Purpose |
|------|---------|
| `main.js` | HTTP server, websocket routing, health check, Stream Deck API. |
| `ws-handler.js` | Connection handlers for agents, viewers, and stewards. Agent socket registry for reverse messaging. Steward coordination (identity, incident locking). |
| `session-store.js` | `SessionStore` class — single shared driver pool. Lap finalization, distance trace compression, raw-frame ring buffer, blue flag detection, contact detection, penalty serving verification. |
| `broadcast.js` | `broadcastToViewers()`, `sendToViewer()` — message delivery to connected clients. |
| `protocol.js` | `MSG` constants — shared vocabulary between agent, server, and clients. |
| `session-recorder.js` | `SessionRecorder` class — appends every frame, lap, incident, penalty, and event to per-session NDJSON files in `data/sessions/`. |
| `profiles.js` | Per-driver best-lap profile persistence in `data/profiles/`. |
| `race-plans.js` | Race plan save/load/delete persistence. |

### SessionStore internals

**Raw-frame ring buffer:** Pre-allocated array of 2,400 slots per driver (120 seconds at 20Hz, ~500KB). Circular write on every frame. `getRawFrames(driverId, startTime, endTime)` queries by sessionTime range — this is what powers incident review telemetry.

**Blue flag detection:** Every frame, compares all connected driver pairs. If a lapping car (more laps completed) is within 5% track distance of a slower car for >8 seconds continuously, fires `blueFlag:violation`. 60-second cooldown per pair.

**Contact detection:** Every frame, finds all drivers with |latG| > 1.8g. If two spiking drivers are within 2% track distance, fires `contact:detected`. 10-second cooldown per pair.

**Incident tracking:** Watches each driver's `incidents` field (iRacing's cumulative `PlayerCarMyIncidentCount`). When it increments, fires `incident:flagged` with the delta, classified as `contact` (2x+) or `off-track` (1x).

**Penalty serving verification:** When a drive-through or stop-go penalty is issued, tracks the driver's `onPitRoad` and `speed`. Drive-through is served when the driver enters and exits pit road. Stop-go is served when the driver enters pit and stops (speed < 1), then exits. Fires `penalty:served`.

### Multi-steward coordination

- Stewards identify via `steward:hello` with name and role (MAIN/SUPPORT).
- `steward:lockIncident` prevents two stewards reviewing the same incident. If already locked, the requesting steward gets a denial with the lock holder's name.
- `steward:unlockIncident` releases the lock. Locks auto-release when a steward disconnects.
- `steward:list` broadcasts the current steward roster and lock state to all stewards.

### Session recording

`SessionRecorder` creates NDJSON files named `{timestamp}_{trackName}.ndjson`. Every line is a JSON object tagged with a type:

```
{"t":"session","ts":1713045600000,"trackName":"Sebring","trackId":237}
{"t":"driver","ts":1713045601000,"d":"driver-agent-1","name":"J.Smith","car":"GT3 R"}
{"t":"frame","ts":1713045601050,"d":"driver-agent-1","st":3245.5,"data":{...}}
{"t":"lap","ts":1713045720000,"d":"driver-agent-1","ln":5,"lt":121.45,...}
{"t":"incident","ts":1713045800000,"d":"driver-agent-1","delta":2,"total":4}
{"t":"penalty","ts":1713045900000,"d":"driver-agent-1","type":"drive-through"}
{"t":"event","ts":1713046000000,"type":"driver_left","data":{...}}
```

Recording starts automatically when the first agent connects with track info. Keys are abbreviated (`t`, `ts`, `d`, `st`, `ln`, `lt`) to minimize disk usage at 20Hz write rate.

---

## 3. Steward App (`apps/steward/`)

Electron + React + Vite desktop application. Runs on the steward's PC alongside iRacing. Connects to `ws://45.55.216.21/ws/steward`.

### Architecture

- **Electron main process** (`electron/main.js`): Window management, IPC handlers for iRacing SDK replay control (stubbed, ready for `node-irsdk-2023`).
- **Preload bridge** (`electron/preload.js`): Exposes `window.irsdk` API — `replayJump()`, `replaySpeed()`, `replayCamera()`, `getStatus()`.
- **React renderer** (`src/`): All UI components.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  Header: BPR Race Control — track, drivers, connection   │
├────────────┬─────────────────────────────────────────────┤
│            │                                             │
│  Driver    │  [Telemetry] [Standings]  ← view tabs       │
│  List      │                                             │
│            │  Telemetry: uPlot charts (throttle, brake,  │
│  (click    │  speed, steer) for involved drivers         │
│  to select │                                             │
│  for       │  ┌─────────────────┐ ┌──────────────────┐  │
│  incidents)│  │ Replay Controls │ │ Track Map +      │  │
│            │  │ Play/Pause/LIVE │ │ Incident Heatmap │  │
│            │  │ Speed ¼-4x     │ │                  │  │
│            │  │ Jump ±5s/±10s  │ │                  │  │
│────────────│  │ Driver ◀ ▶     │ └──────────────────┘  │
│            │  │ Camera (7 views)│                        │
│  Incident  │  └─────────────────┘                        │
│  Panel     │                                             │
│  (flag,    │  Penalty Panel (when reviewing):            │
│  filter,   │  No Action / Race Incident / Warning /      │
│  review)   │  Drive-Thru / Stop-Go / Time / DSQ          │
│            │                                             │
│────────────│  ┌──────────────────────┐ ┌──────────────┐  │
│  Race      │  │ Driver Summary Table │ │ Report       │  │
│  Control   │  │ (contacts, off-track,│ │ Export       │  │
│  Messages  │  │  blue flags, inc pts,│ │ (CSV/JSON)   │  │
│  (templates│  │  penalties per driver)│ │              │  │
│  + custom) │  └──────────────────────┘ └──────────────┘  │
└────────────┴─────────────────────────────────────────────┘
```

### Components (11)

| Component | What it does |
|-----------|-------------|
| `DriverList` | Shows all connected drivers. Click to select for incident flagging. Selected drivers highlighted purple. |
| `IncidentPanel` | Flag incidents at current sessionTime. Filter toggles: Contact (2x+), Off-track (1x), Blue Flag, Driver Report, Manual. Shows incident log with type tags (CONTACT, 1x, BLUE FLAG, PROTEST). Click "Review" to load telemetry + notify drivers. |
| `TelemetryOverlay` | 4 stacked uPlot charts (throttle, brake, speed, steer) showing raw frames from the server's ring buffer for involved drivers. Shared synced cursor across all charts. One color per driver (purple, green, amber, blue, etc.). |
| `PenaltyPanel` | 7 penalty buttons color-coded by severity. Time input appears for time penalties. Steward notes textarea. Confirm sends `notify:penalty` to server, which forwards to each involved driver's agent. |
| `ReplayControls` | Play/Pause, LIVE button (jump to live replay), Speed (¼x-4x), Jump (±5s/±10s), Driver nav (◀/▶ with name display), Camera (Cockpit, Chase, Far Chase, Front, Rear, Chopper, Blimp). All wired through IPC to `window.irsdk`. |
| `LiveStandings` | Full race standings table. Position, car #, driver, laps, interval, gap, best/last lap, S1/S2/S3 sectors (purple = overall best, green = PB), iRating, pit status. Click a row to switch iRacing camera to that car. |
| `RaceControlMessages` | Template buttons (Yellow Flag, Track Limits) + custom message input. Send to all drivers or single driver. **Confirmation dialog** prevents accidental sends — shows exact message and target before broadcasting. |
| `DriverSummaryPanel` | Table: driver name, laps, contacts, off-tracks, blue flags, total incident points, penalty count. Color-coded by severity. |
| `TrackMap` | Canvas rendering of track shape with live car position dots updated via `requestAnimationFrame`. Pit road indicator (amber ring). Color-coded legend. |
| `IncidentHeatmap` | Track outline colored by incident density. Brighter = more incidents. Contact dots red, blue flags blue, off-tracks amber. |
| `ReportExport` | Export CSV and JSON post-race reports. Includes all incidents, penalties, steward notes, and driver summary stats. Downloads to steward's machine. |

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| Space | Play/pause replay |
| ← / → | Jump -5s / +5s |
| [ / ] | Previous / next driver |
| 1-6 | Camera views (cockpit, chase, far chase, front, chopper, blimp) |
| Tab | Toggle Telemetry / Standings view |
| Escape | Cancel incident review |

### Incident workflow

1. Steward selects involved drivers in the driver list
2. Clicks "Flag" → incident created at current sessionTime
3. Auto-detected incidents (contact, blue flag, 1x, driver protest) appear automatically tagged
4. Steward clicks "Review" on an incident:
   - Server sends raw frames from the ring buffer (`request:incidentWindow`)
   - Telemetry overlay populates with involved drivers' data
   - iRacing replay jumps to that sessionTime (via IPC)
   - Involved drivers get "INCIDENT UNDER INVESTIGATION" overlay
5. Steward selects penalty type, adds notes, clicks "Confirm Decision"
6. `notify:penalty` sent to server → forwarded to each driver's agent → overlay appears on driver's screen
7. Penalty serving tracked automatically (drive-through/stop-go)

---

## 4. Broadcast Dashboard (`apps/web/`)

Vite + React web app served at `http://45.55.216.21`. Connects to `/ws/viewer`. Read-only — no steward controls.

### Layout

```
┌───────────────────────────────────────────┬─────────────┐
│  LIVE STANDINGS                           │  TRACK MAP  │
│  (position, #, driver, laps, interval,    │  (car dots) │
│   gap, best, last, S1, S2, S3, pit)       │             │
│  Purple = overall best sector             ├─────────────┤
│  Green = personal best                    │  BATTLES    │
│                                           │  (cars < 1.5s│
│                                           │   apart)    │
├──────────┬──────────────────┬─────────────┼─────────────┘
│  SESSION │  RACE FEED       │  LIVE TELEM │
│  TIMER   │  ┌──────────────┐│  (speed,    │
│          │  │ status bar:  ││  gear, T/B  │
│  Remain  │  │ 2 under rev  ││  bars for   │
│  Elapsed │  │ 1 pen pending││  top 6      │
│          │  ├──────────────┤│  drivers)   │
│          │  │ INC  +2x     ││             │
│          │  │ CONTACT A+B  ││             │
│          │  │ PENALTY DT   ││             │
│          │  │ SERVED DT    ││             │
│          │  │ PROTEST filed││             │
│          │  │ FAST new best││             │
│          │  └──────────────┘│             │
└──────────┴──────────────────┴─────────────┘
```

### Components (5 broadcast-specific)

| Component | What it does |
|-----------|-------------|
| `BroadcastStandings` | F1-style timing tower. Color-coded sectors, pit badges, overall best highlighting. |
| `BattleTracker` | Auto-detects cars within 1.5s. Sorted by gap. Red highlight for gaps < 0.5s ("hot" battles). |
| `SessionTimer` | Large countdown from `sessionTimeRemain`. Amber when < 10min, red when < 2min. Shows elapsed time. |
| `IncidentFeed` | Live event feed with type tags (INC, CONTACT, BLUE, PENALTY, SERVED, INV, PROTEST, RC, FAST, JOIN, LEFT). Status bar shows active counts: "2 under review | 1 penalty pending | 3 contacts". |
| `TelemetrySnippet` | Mini telemetry cards for up to 6 drivers — speed, gear, throttle/brake bars, current/best lap time. |

The existing `TrackMap` component from `components/track/` is reused for live car positions.

---

## 5. Message Protocol (`protocol.js`)

All websocket messages use `{ type, payload }` format. Complete list:

### Agent → Server
| Type | Payload | When |
|------|---------|------|
| `agent:hello` | `{ driverName, car, trackId, trackName, trackLength }` | On connect |
| `agent:frame` | Full telemetry object (20+ channels) | 20Hz |
| `agent:standings` | Array of driver standings | 2Hz |
| `agent:sessionInfo` | `{ trackName, trackId }` | Session change |
| `agent:protest` | `{ reason }` | Driver presses F1 |

### Server → Viewer/Steward
| Type | Payload | When |
|------|---------|------|
| `session:snapshot` | `{ sessionInfo, drivers[], trackShape }` | On connect |
| `driver:joined` | `{ driverId, driverName, car }` | Agent hello |
| `driver:left` | `{ driverId, replaced }` | Agent disconnect |
| `telemetry:frame` | `{ driverId, ...frameData }` | 20Hz per driver |
| `lap:complete` | `{ driverId, lapNumber, lapTime, sectors, bestLap }` | Lap finish |
| `standings` | Array of standings | 2Hz |
| `track:shape` | `{ points }` | First valid lap |
| `event` | `{ id, type, timestamp, data }` | Any event |
| `incident:flagged` | `{ driverId, delta, newCount, sessionTime }` | Incident count change |
| `blueFlag:violation` | `{ slowDriverId, fastDriverId, duration }` | Blue flag held >8s |
| `contact:detected` | `{ driverAId, driverBId, latGA, latGB }` | Simultaneous lat-G spike |
| `penalty:served` | `{ driverId, penaltyType }` | DT/SG completed |
| `driver:protest` | `{ driverId, driverName, sessionTime, reason }` | Driver protest |

### Steward → Server
| Type | Payload | When |
|------|---------|------|
| `request:incidentWindow` | `{ driverIds, centerSessionTime, windowSeconds }` | Review incident |
| `notify:penalty` | `{ driverId, penaltyType, timeSeconds, notes }` | Issue penalty |
| `notify:underInvestigation` | `{ driverIds, notes }` | Start review |
| `server:message` | `{ message, target }` | RC broadcast |
| `steward:hello` | `{ name, role }` | Identify steward |
| `steward:lockIncident` | `{ incidentId }` | Claim incident |
| `steward:unlockIncident` | `{ incidentId }` | Release incident |

### Server → Agent (reverse channel)
| Type | Payload | When |
|------|---------|------|
| `server:penalty` | `{ type, timeSeconds, notes }` | Penalty issued |
| `server:underInvestigation` | `{ notes }` | Review started |
| `server:message` | `{ message }` | RC broadcast |
| `server:protestAck` | `{ message }` | Protest received |

### Server → Steward only
| Type | Payload | When |
|------|---------|------|
| `incident:window` | `{ frames: { driverId: frame[] } }` | Raw frame response |
| `steward:list` | `{ stewards[], locks }` | Steward roster change |
| `incident:locked` | `{ incidentId, stewardName }` | Incident claimed |
| `incident:unlocked` | `{ incidentId }` | Incident released |

---

## 6. Data Storage

### In-memory (SessionStore)
- Driver registry with connection state, lap history, stint tracking
- Per-driver raw-frame ring buffer (120s at 20Hz = 2,400 frames)
- Per-driver incident count tracking
- Blue flag proximity pairs + cooldowns
- Contact detection cooldowns
- Pending penalty serving queue
- Event log (last 200 events)

### On disk
- `data/sessions/*.ndjson` — full session recordings (every frame from every driver)
- `data/profiles/*.json` — per-driver best lap profiles per track

---

## 7. Infrastructure

| Component | Location |
|-----------|---------|
| Server | DigitalOcean droplet `45.55.216.21` |
| Web app | Served by same droplet via nginx |
| Agent | Driver's PC (PyInstaller .exe) |
| Steward app | Steward's PC (Electron) |
| Deploy | `deploy.sh` — Node 20, nginx, pm2, ufw |

### Endpoints
| URL | Purpose |
|-----|---------|
| `ws://45.55.216.21/ws/agent` | Agent telemetry stream |
| `ws://45.55.216.21/ws/viewer` | Broadcast dashboard |
| `ws://45.55.216.21/ws/steward` | Steward app |
| `http://45.55.216.21/health` | Health check |
| `http://45.55.216.21/` | Broadcast web dashboard |

---

## 8. Key Design Decisions

- **`sessionTime` is the universal time key.** Every frame, incident, penalty, and replay scrub point is anchored to iRacing's session clock. Cross-car sync and telemetry-to-replay sync are free.
- **Single driver pool.** No team scoping. All drivers in one `SessionStore`. Every viewer and steward sees every driver.
- **Inline styles only.** No Tailwind/CSS modules in the steward app. Consistent with the project's styling conventions.
- **Ring buffer, not full history.** 120 seconds of raw frames per driver in memory. Enough for incident review. Full history goes to disk via session recording.
- **Steward app is Electron.** Browser can't access iRacing's SDK. Desktop app can control replay via `BroadcastMsg`.
- **IPC per concern.** `irsdk:replay` for replay commands, `irsdk:session` for session info, `irsdk:status` for connection status.
- **Auto-detection supplements manual.** Server auto-flags incidents (contact, blue flag, incident count), but stewards can also flag manually. Both appear in the same incident feed.

---

## 9. What's Stubbed (Ready for Integration)

The iRacing SDK integration in the Electron main process is stubbed. The IPC bridge is wired, the renderer calls the right methods, and the handlers log to console. When `node-irsdk-2023` is added:

1. `irsdk:replay:jump` → `BroadcastMsg(ReplaySearchSessionTime, sessionTime)`
2. `irsdk:replay:speed` → `BroadcastMsg(ReplaySetPlaySpeed, speed)`
3. `irsdk:replay:camera` → `BroadcastMsg(CamSwitchNum, carIdx, camGroupNum)` (resolve camera name to group number via `CameraInfo.Groups[]`)
4. `irsdk:status` → return real connection state from the SDK

The `-1` sentinel value on `replayJump` means "go to live" — maps to jumping to the end of the replay buffer.
