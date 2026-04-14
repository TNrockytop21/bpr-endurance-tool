# BPR Race Control — Project Context

This file is the handoff brief for Claude Code. Read it first, then
explore the repo before making changes. The goal, the data model, and
the non-negotiable constraints are all here.

---

## What this is

A **race control and stewarding application** for iRacing league
management. Stewards and race directors use this tool to monitor a
live race, review incidents, issue penalties, control iRacing's
in-game replay, and communicate decisions back to drivers — all from
one integrated interface.

The existing telemetry pipeline already works: each driver runs a
Python agent on their PC that reads iRacing shared memory via
`pyirsdk` and streams telemetry over a websocket to a DigitalOcean
droplet. We are building race control on top of that pipeline.

There is no team dashboard in this project. Team-facing endurance
features (fuel strategy, stint planning, coaching) have been moved
to a separate project. This codebase is race control only.

Primary use: BPR / UGT / BNL league races. Secondary future use:
iRacing official team special events.

---

## Current system

**Droplet:** `45.55.216.21` (ingests and serves websocket traffic)
**Agent endpoint:** `ws://45.55.216.21/ws/agent`
**Viewer endpoint:** `ws://45.55.216.21/ws/viewer`
**Health check:** `http://45.55.216.21/health`

### Repo layout
```
agent/                    Python agent (pyirsdk -> websocket)
  launcher.py             Tk GUI, asks for name, clicks connect
  capture.py              read_frame / read_standings / session info
  protocol.py             message envelope helpers
  config.py               SERVER_URL, SEND_RATE_HZ, CAPTURE_RATE_HZ
  requirements.txt        pyirsdk>=1.5.0, websockets>=13.0
apps/
  server/src/             Node + Express + ws
    main.js               http server, /ws routing, /health
    ws-handler.js          agent + viewer + steward connection handlers
    session-store.js      SessionStore (single shared driver pool)
    broadcast.js          send helpers
    protocol.js           MSG constants (shared vocabulary)
    profiles.js           per-driver best-lap profile persistence
    race-plans.js         saved race plan persistence
  web/                    Vite frontend (race control observer view)
  steward/                Electron app (primary steward interface)
installer/                Inno Setup + PyInstaller build for BPR-Agent.exe
deploy.sh                 Droplet provisioning (Node 20, nginx, pm2, ufw)
```

### Current data flow

1. Driver launches `BPR-Agent.exe`, enters name, clicks connect
2. Agent connects `ws://45.55.216.21/ws/agent`
3. Agent sends `agent:hello` (driverName, car, trackId, trackName)
4. Agent sends `agent:frame` at 20Hz (captured at 60Hz internally)
5. Server adds driver to the single shared `SessionStore`
6. `SessionStore.updateFrame` buffers samples until lap change, then
   finalizes the lap: compresses samples into a 1000-bin distance
   trace. Raw samples are also kept in a per-driver ring buffer
   (120 seconds) for incident review.
7. Server broadcasts `telemetry:frame` to all connected viewers
   and stewards

### Telemetry channels captured in `agent/capture.py`

Core (always present): `lap`, `lapDist`, `lapTime`, `throttle`,
`brake`, `speed`, `rpm`, `gear`, `steer` (degrees, already converted
from radians), `latG`, `lonG`, `fuel`, `onPitRoad`, `position`,
`sessionTime`, `sessionTimeRemain`.

Optional (wrapped in try/except): tire temps + wear per corner,
brake temps per corner, shock deflection per corner, water/oil temp,
oil pressure, voltage, fuel pressure, fuel use per hour, clutch,
brakeRaw, ABS, TC, air temp, track temp, wind, `incidents`
(`PlayerCarMyIncidentCount`), lap delta, last lap time.

**`sessionTime` is the cornerstone of everything.** It's iRacing's
own authoritative session clock, shared by every driver's agent
frames and by iRacing's replay system. Cross-car sync and
telemetry-to-replay sync are effectively free — no drift correction,
no manual offsets.

---

## What we're building

### The steward workflow

This is the core use case that drives every design decision:

1. An incident happens on track during a live race
2. A steward clicks "New Incident" and selects the involved drivers
   (or the system auto-detects via telemetry spikes)
3. The system captures the `sessionTime` of the incident
4. The steward clicks "Review" — this does two things simultaneously:
   - **iRacing replay** jumps to that `sessionTime` via
     `BroadcastMsg(ReplaySearchSessionTime, t)` on the steward's
     local iRacing instance
   - **Telemetry overlay** shows synced throttle/brake/steer/speed
     traces for the involved drivers, anchored to that same
     `sessionTime` window
5. The steward scrubs through the replay and telemetry together,
   using intuitive play/pause/speed controls
6. The steward issues a decision: No Action / Race Incident /
   Drive-Thru / Stop-Go / Time Penalty / DSQ
7. The penalty is logged with full audit trail (who issued it, when,
   notes) and broadcast to the affected driver(s) as an in-game
   notification
8. Multiple stewards can work simultaneously — one reviews an
   incident while another monitors live, with coordination to prevent
   double-handling

### Capability map

| Capability | Where it runs | Status |
|---|---|---|
| Live telemetry streaming (agent → server) | Agent + Server | Working |
| Lap finalization + distance traces | Server | Working |
| Raw-frame ring buffer (120s per driver) | Server | TODO |
| Cross-driver telemetry view | Web + Steward | TODO |
| Incident flagging (auto + manual) | Server + Steward | TODO |
| Incident review with telemetry overlay | Steward (Electron) | TODO |
| iRacing replay control (jump/play/pause/speed) | Steward (Electron) | TODO |
| Click-incident-to-replay sync | Steward (Electron) | TODO |
| Penalty issuance + audit trail | Steward + Server | TODO |
| In-game driver notification of penalties | Server → Agent | TODO |
| Multi-steward coordination | Server + Steward | TODO |
| Session recording to disk | Server | TODO |
| Post-race report export | Steward / Web | TODO |

---

## Architecture decisions (locked in)

- **Steward app is Electron**, not web. iRacing's `BroadcastMsg`
  API (replay control, scrubbing, play/pause/speed) only works
  against a *local* iRacing instance. A browser cannot reach
  iRacing's SDK. A desktop app running on the steward's PC can.
  Use `node-irsdk-2023` for the Node binding.
- **Stack:** Electron + React + Vite, React in renderer, SDK access
  in main process. `uPlot` for telemetry overlays (fastest
  multi-series scrubbing at this sample rate).
- **Steward app is its own package** under `apps/steward/` — sibling
  to `apps/server/` and `apps/web/`.
- **Web app is a minimal race control observer view.** Race directors
  and non-steward officials use it to watch standings, driver status,
  and incident log. It does not control replays or issue penalties.
- **Single driver pool.** No team scoping on the server. All
  connected drivers are in one shared `SessionStore`. Every viewer
  and steward sees every driver.
- **`sessionTime` is the universal time key.** Every stored frame,
  every incident, every replay scrub point is anchored to it.
- **Reverse communication channel.** The agent websocket is
  bidirectional. Server can push messages to drivers (penalty
  notifications, race control messages) via the same connection the
  agent uses to send frames.
- **Multi-steward by design.** The server tracks which steward is
  reviewing which incident to prevent double-handling. Steward roles
  (MAIN / SUPPORT) can be assigned per session.

---

## Build order (priority)

### Phase 1 — Server foundation + Electron shell

1. **Server: raw-frame ring buffer** in `session-store.js`.
   Per-driver, 120-second rolling window at 20Hz. Push on every
   `updateFrame`, roll off the back.
2. **Server: remove team scoping.** Delete `TeamManager`, flatten
   to single `SessionStore`. Remove BPR message layer. All viewers
   see all drivers.
3. **Server: `/ws/steward` endpoint.** New handler in
   `ws-handler.js`. Stewards get everything viewers get plus
   incident management and raw-frame requests.
4. **Server: `request:incidentWindow` handler.** Steward sends
   `{driverIds, centerSessionTime, windowSeconds}`, server returns
   raw frames from each driver's ring buffer in that window.
5. **Electron app shell.** `apps/steward/` package. Electron +
   React + Vite. Dark theme. Connects to droplet via websocket.
6. **Live driver list + incident entry.** Click a driver at a given
   `sessionTime`, mark the moment, add involved drivers.
7. **Telemetry overlay panel.** Stacked throttle/brake/steer/speed
   charts with a scrubbable time cursor, one color per selected
   driver. uPlot, bound to `sessionTime` axis.

### Phase 2 — Replay integration + penalties

8. **iRacing SDK integration** in Electron main process
   (`node-irsdk-2023`). `BroadcastMsg(ReplaySearchSessionTime, t)`
   to jump replay. Play/pause/speed controls exposed to renderer
   via IPC.
9. **Click-to-replay.** Click an incident → replay jumps to that
   `sessionTime` + telemetry overlay populates with involved
   drivers' data. One action, two synced views.
10. **Penalty issuance.** Buttons: No Action / Race Incident /
    Drive-Thru / Stop-Go / Time Penalty / DSQ. Each logged with
    steward ID, timestamp, notes.
11. **Driver notification.** Penalty decisions pushed from server
    through the agent websocket. Agent displays an overlay or
    notification in the driver's iRacing session. Requires a new
    `server:penalty` message type and agent-side handler.
12. **Incident resolution UI.** Full audit trail visible in the
    steward app: who flagged it, who reviewed it, what was decided,
    when.

### Phase 3 — Multi-steward + recording

13. **Multi-steward coordination.** Server tracks active stewards,
    which incidents are being reviewed by whom. Locking mechanism
    so two stewards don't resolve the same incident. MAIN/SUPPORT
    role assignment.
14. **Session recording to disk.** Append every frame to per-session
    NDJSON on the droplet. Enables post-race review, reports,
    historical stats.
15. **Auto-incident detection.** Contact (simultaneous lat-G spikes
    within N meters), off-track (speed drop + `lapDist` stall),
    pit-lane speeding (`onPitRoad` + speed > limit), unsafe release.

### Phase 4 — Polish + reporting

16. **Post-race PDF/CSV report.** All incidents, penalties, steward
    notes exported for league records.
17. **Track map with live car positions.**
18. **Track incident heatmap** (aggregate across sessions).
19. **Penalty serving verification** (watch `onPitRoad` + speed to
    confirm drive-through/stop-go were actually served).
20. **Season standings / championship points integration.**

---

## Data model (canonical, first-class)

These are real entities. Making them persistent unlocks every
downstream feature.

- **Session** — one race, practice, or qualifying. Has `sessionId`,
  league, event name, track, start time, duration. Owns everything
  else.
- **Participant** — a driver entry in a session. Identified by
  `driverId`. In team events, backed by iRacing's `TeamID`.
- **Frame** — one telemetry sample. Keyed by `(sessionId, driverId,
  sessionTime)`. What the ring buffer holds in memory and what
  session recording persists to disk.
- **Lap** — finalized when a driver crosses start/finish. Compressed
  trace + sectors.
- **Incident** — `{id, sessionId, sessionTime, lap, type,
  involvedDrivers, location (lapDist), severity, detectedBy,
  reviewedBy, status}`. Auto-flagged or manually created.
  Status: `open → under_review → resolved`.
- **Penalty** — the resolution of an incident. `{incidentId,
  driverId, type (DT / SG / time / DSQ / race-incident / no-action),
  timeSeconds, notes, issuedBy, issuedAt, servedAt,
  notifiedAt}`.
- **Steward** — `{stewardId, name, role (MAIN / SUPPORT),
  connectedAt}`. Tracked by the server for coordination.
- **Event** — audit log (driver joined, pit, best lap, penalty
  issued, steward action, etc.).

---

## iRacing SDK integration (steward app)

The steward runs iRacing on the same PC as the Electron app. The
Electron main process uses `node-irsdk-2023` to:

### Replay control
- `BroadcastMsg(ReplaySearchSessionTime, sessionTime)` — jump to
  a specific moment. This is the key to click-incident-to-replay.
- `BroadcastMsg(ReplaySetPlaySpeed, speed)` — play/pause/slow-mo.
- `BroadcastMsg(CamSwitchNum, carIdx, camGroupNum)` — switch camera
  to a specific car involved in the incident.

### Replay state reading
- `ReplayFrameNum`, `ReplayPlaySpeed` — current replay position
  and speed, for syncing the telemetry scrub cursor.

### Driver info
- `DriverInfo.Drivers[]` — full roster with `UserID`, `CarIdx`,
  `UserName`, `IRating`, license fields.

### IPC design
One IPC channel per concern:
- `irsdk:replay` — replay commands (jump, play, pause, speed, camera)
- `irsdk:session` — session info, driver roster
- `irsdk:status` — connection status, errors

---

## Team identity in special events

For iRacing official team sessions (driver-swap format),
`DriverInfo.Drivers[]` provides:

- `TeamID` — unique integer, stable across the subsession
- `TeamName` — display string
- `TeamIncidentCount` — running team incident total
- `CarIdx` — all drivers on a team share the same `CarIdx`
- `UserID` — individual driver's iRacing account ID
- `CarIdxUserID[carIdx]` — which human is in the seat right now

`capture.py` does **not** currently read `TeamID` / `TeamName` /
`CarIdxUserID`. Adding them is ~10 Python lines and unlocks the
special-events use case.

---

## Styling conventions (strict, enforced across all views)

- **Inline styles only.** No Tailwind, no CSS modules, no CSS-in-JS
  libraries. Consistent with the existing React pages.
- **Background:** `#060608`
- **Cards:** `#0d0d0f`
- **Borders:** `#1a1a1a`, `#222`, up to `#2a2a2a` for emphasis
- **Body text:** minimum `#cccccc`, never below `#888888` for labels
- **Labels:** `#888888`, uppercase letter-spacing 0.5-0.8px,
  font-size 9-10px
- **Accent colors:**
  - UGT red: `#c8102e`
  - BNL gold: `#d4a017`
  - "Am" division blue: `#378add`
  - Severity red / main action: `#ef4444`
  - Warning amber: `#f59e0b`
  - Success green: `#22c55e`
- **Font:** system sans, tabular-nums for all numeric columns and
  timestamps
- **Radius:** 3-4px for controls, 4-6px for cards, never more

---

## Known gotchas

- **Windows Defender / SmartScreen will flag the unsigned agent
  .exe.** Use `--onedir` not `--onefile`, add version info + icon.
  Long-term: buy a code signing cert.
- **PyInstaller + PyQt on Python 3.14** works. Don't upgrade without
  a reason.
- **nginx 60-second default proxy timeout.** Long-lived websockets
  need `proxy_read_timeout 86400`. `deploy.sh` already has this.
- **Agent changes require redistribution.** Every driver has to
  download a new build. Batch agent changes.
- **iRacing S3 links expire in 120 seconds.** If integrating with
  iRacing's results API, fetch server-side immediately.

---

## Conventions and preferences

- Commit before every meaningful change.
- When adding server handlers, extend `protocol.js` first (the
  `MSG` constants are the shared vocabulary). Keep agent, server,
  and client protocol in lockstep.
- There is a single `SessionStore` instance. No team routing, no
  multi-store pattern.
- Batch agent changes to minimize redistribution.
- For the Electron steward app, use one IPC channel per concern
  (replay commands, session info, incident actions) rather than a
  monolithic dispatcher.

---

## Current task

Remove all team scoping from the server (`TeamManager`, BPR message
layer, team-based viewer routing) and from the agent (team dropdown,
`?team=` URL param). Flatten to a single shared driver pool. Then
strip the web app of team-specific pages and promote the overview
as the main view.
