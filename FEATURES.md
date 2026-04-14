# BPR Race Control — Feature Guide

Detailed description of every feature in the system, how it works from the user's perspective, and the technical flow behind it.

---

## STEWARD FEATURES

### 1. Live Driver Monitoring

**What the steward sees:** A sidebar list of every driver connected to the server. Each row shows the driver's name, car, lap count, and a green/gray connection status dot.

**How it works:** When a driver launches their agent and connects, the server broadcasts `driver:joined` to all stewards. The driver list updates in real-time. When a driver disconnects, they stay in the list but show as offline — their history and lap data remain accessible.

**Interaction:** Click a driver to select them (highlighted in purple). Multiple drivers can be selected simultaneously. Selected drivers are used when flagging incidents — the "Flag" button creates an incident involving all currently selected drivers.

---

### 2. Incident Flagging (Manual)

**What the steward does:** Selects one or more drivers from the driver list, optionally types a note, and clicks "Flag @ XX:XX" (showing the current session time).

**What happens:**
- An incident entry is created with a unique ID, the current `sessionTime`, the list of involved driver IDs, and the steward's notes
- The incident appears in the incident feed below the flag button
- The incident status is "open" (amber badge)

**Technical flow:** This is entirely client-side in the steward app — the incident is stored in React state. It only hits the server when the steward clicks "Review" (which requests the raw-frame telemetry window).

---

### 3. Incident Auto-Detection

**What happens automatically:** The server watches every incoming telemetry frame for three types of events:

#### 3a. Incident Point Detection
- **Trigger:** A driver's `incidents` field (iRacing's `PlayerCarMyIncidentCount`) increments
- **Classification:** +1x = "off-track", +2x or more = "contact"
- **Steward sees:** An incident appears in the feed tagged "CONTACT" (red border) or "1x" (gray border) with the delta and total count
- **Example:** "CONTACT — D. Newman +2x incident (total: 6)"

#### 3b. Contact Detection
- **Trigger:** Two drivers both experience |latG| > 1.8g simultaneously while within 2% track distance of each other
- **Steward sees:** An incident tagged "CONTACT" with both drivers listed
- **Example:** "CONTACT — Probable contact — D. Newman + A. Riegel"
- **Cooldown:** Same pair won't re-trigger for 10 seconds
- **Why both 3a and 3b:** 3a catches all incidents (including solo spins that iRacing counts). 3b specifically identifies *who was involved* in car-to-car contact by correlating telemetry across two cars.

#### 3c. Blue Flag Violation
- **Trigger:** A lapping car (more laps completed) is within 5% track distance of a slower car for more than 8 continuous seconds
- **Steward sees:** An incident tagged "BLUE FLAG" with both drivers and the duration
- **Example:** "BLUE FLAG — Blue flag ignored for 12s — D. Newman blocking A. Riegel"
- **Cooldown:** Same pair won't re-trigger for 60 seconds

---

### 4. Incident Filtering

**What it does:** Filter toggles at the top of the incident feed let the steward show/hide incident categories:

| Filter | Default | What it controls |
|--------|---------|-----------------|
| Contact (2x+) | ON | Collisions and car contact |
| Off-track (1x) | OFF | Solo off-tracks (not a stewarding issue) |
| Blue flag | ON | Blue flag violations |
| Driver Report | ON | Protests filed by drivers |
| Manual | ON | Steward-flagged incidents |

**Why off-track is off by default:** 1x incidents are overwhelmingly off-tracks that don't require steward action. Showing them would flood the feed. Stewards can toggle them on if needed for a specific investigation.

**Visual:** Each incident has a colored left border matching its category (red = contact, gray = 1x, blue = blue flag, amber = protest, purple = manual). The filtered count shows "X hidden" when filters are active.

---

### 5. Incident Review + Telemetry Overlay

**What the steward does:** Clicks "Review" on any incident in the feed.

**What happens simultaneously:**
1. **Telemetry loads:** The steward app sends `request:incidentWindow` to the server with the involved driver IDs, the incident's `sessionTime`, and a 20-second window. The server queries each driver's raw-frame ring buffer and returns the frames.
2. **Charts render:** Four stacked uPlot charts appear — throttle, brake, speed, and steer — showing the involved drivers' data overlaid on the same time axis. Each driver gets a distinct color (purple, green, amber, blue, etc.). All four charts share a synced cursor — hover on one, the vertical line appears on all.
3. **Drivers notified:** `notify:underInvestigation` is sent to the server, which forwards `server:underInvestigation` to each involved driver's agent. The driver sees an amber "INCIDENT UNDER INVESTIGATION" overlay on their screen.
4. **Replay jumps (when SDK is connected):** `window.irsdk.replayJump(sessionTime)` is called, which (once wired to `node-irsdk-2023`) will scrub the steward's iRacing replay to the exact moment of the incident.

**What the steward can read from the telemetry:**
- Did the driver brake late? (Compare brake traces — the later braker is visible)
- Did someone fail to leave space? (Steer trace shows sudden corrective input at the contact moment)
- How fast were they going? (Speed trace shows velocity delta)
- Was it intentional? (Throttle trace shows if someone accelerated into contact)

---

### 6. Replay Controls

**What it provides:** A control bar with play/pause, speed selection, time jumping, driver switching, camera selection, and a live button.

**Controls:**
| Control | Options | What it does |
|---------|---------|-------------|
| Play/Pause | Toggle | Starts/stops replay playback |
| LIVE | Button (red) | Jumps replay to live, resumes 1x speed |
| Speed | ¼x, ½x, 1x, 2x, 4x | Sets replay playback speed |
| Jump | -10s, -5s, +5s, +10s | Scrubs replay forward/backward |
| Driver | ◀ Name ▶ | Cycles through connected drivers, switches camera to selected car |
| Camera | Cockpit, Chase, Far Chase, Front, Rear, Chopper, Blimp | Switches iRacing camera view for the focused driver |

**Technical:** All controls call through the Electron IPC bridge (`window.irsdk.replaySpeed()`, `replayJump()`, `replayCamera()`). Currently stubbed — logs to console. When `node-irsdk-2023` is integrated, these become actual `BroadcastMsg` calls to iRacing.

**Keyboard shortcuts:** Space (play/pause), arrows (scrub), `[`/`]` (driver), 1-6 (cameras), Escape (cancel review), Tab (switch view).

---

### 7. Penalty Issuance

**What the steward does:** After reviewing telemetry, clicks one of 7 penalty buttons, optionally types notes, and clicks "Confirm Decision."

**Penalty types:**
| Type | Color | What it means |
|------|-------|--------------|
| No Action | Green | Reviewed, no penalty warranted |
| Race Incident | Blue | Contact occurred but no driver predominantly at fault |
| Warning | Amber | Driver warned, no penalty this time |
| Drive-Through | Red | Must drive through pit lane at speed limit |
| Stop & Go | Red | Must stop in pit box then rejoin |
| Time Penalty | Red | Time added to race result (shows seconds input field) |
| DSQ | Dark red | Disqualified from the session |

**What happens on confirm:**
1. The incident status changes to "resolved" with the penalty attached
2. `notify:penalty` is sent for each involved driver
3. The server forwards `server:penalty` to each driver's agent websocket
4. Each driver sees a transparent overlay banner on their screen with the penalty type, color-coded, with steward notes. Fades after 8 seconds.
5. The server logs a `penalty_issued` event visible to all viewers and the broadcast dashboard
6. For drive-through and stop-go penalties, the server starts monitoring the driver's `onPitRoad` and `speed` to verify serving

---

### 8. Penalty Serving Verification

**What it does:** After a drive-through or stop-go penalty is issued, the server automatically tracks whether the driver serves it.

**Drive-through:** The server watches for the penalized driver to enter pit road (`onPitRoad = true`) and then exit (`onPitRoad = false`). When they exit, `penalty:served` is broadcast.

**Stop & Go:** The server watches for the driver to enter pit road AND come to a stop (`speed < 1 m/s`). After stopping, when they exit pit road, `penalty:served` is broadcast.

**What stewards/broadcast see:** A "SERVED" tagged event appears in the feed: "D. Newman served drive-through."

---

### 9. Race Control Messages

**What it does:** Lets stewards broadcast messages to drivers as transparent overlays on their screens.

**Templates:** Yellow Flag, Track Limits (pre-built, one-click). Custom message input for anything else.

**Target:** Send to all drivers or a single specific driver (dropdown selector).

**Safety:** Every message goes through a confirmation dialog showing the exact text and target before sending. Prevents accidental broadcasts.

**Driver experience:** The message appears as a top-center overlay banner. Color is auto-detected from content (red for "red flag" or "closed", amber for "yellow" or "caution", green for "green" or "open", white for everything else). Fades after 10 seconds. Click to dismiss.

**Technical flow:** Steward sends `server:message` → server forwards to agent(s) via the reverse websocket channel → agent displays overlay. For "all drivers", the server iterates every entry in the `agentSockets` map.

---

### 10. Driver Protest / Report

**What the driver does:** Presses F1 (or clicks "Report Incident" in the agent GUI).

**What happens:**
1. Agent sends `agent:protest` with the driver's current `sessionTime`, `lap`, and `lapDist`
2. Server broadcasts `driver:protest` to all stewards and viewers
3. Server sends `server:protestAck` back to the driver → driver sees "PROTEST RECEIVED — STEWARDS NOTIFIED" overlay
4. Steward sees a "PROTEST" tagged incident in amber in their incident feed
5. 10-second cooldown on the button prevents spam

**Why it matters:** Drivers can immediately flag an incident from their perspective. The steward gets the exact sessionTime so they can pull up the telemetry and replay. No radio communication needed.

---

### 11. Multi-Steward Coordination

**What it does:** Prevents two stewards from reviewing the same incident simultaneously.

**How it works:**
1. Each steward identifies themselves via `steward:hello` with a name and role (MAIN or SUPPORT)
2. When a steward clicks "Review" on an incident, `steward:lockIncident` is sent
3. If the incident is already locked by another steward, the requesting steward gets a denial with the lock holder's name
4. When a steward finishes reviewing (resolves or cancels), `steward:unlockIncident` releases the lock
5. If a steward disconnects, all their locks are automatically released
6. The steward roster and lock state are broadcast to all connected stewards via `steward:list`

---

### 12. Driver Incident Summary

**What it shows:** A table at the bottom of the steward app with one row per driver:

| Column | What it shows |
|--------|-------------|
| Driver | Name + offline indicator |
| Laps | Total laps completed |
| Contact | Number of contact incidents involving this driver |
| Off-Track | Number of 1x off-track incidents |
| Blue Flag | Number of blue flag violations |
| Inc Pts | Total incident points (sum of all deltas) |
| Penalties | Number of penalties issued (excluding no-action and race-incident) |

**Color coding:** Contact count turns red when > 0. Incident points amber at ≤ 4, red at > 4. Penalty count red when > 0. Helps stewards spot repeat offenders.

---

### 13. Track Map + Incident Heatmap

**Track map:** Canvas rendering of the track shape (auto-generated from the first valid lap's telemetry). Live car position dots colored per driver, updated at animation frame rate. Amber ring on cars in pit road.

**Incident heatmap:** Same track shape but colored by incident density. Brighter segments = more incidents at that part of the track. Individual incident dots colored by type (red = contact, blue = blue flag, amber = off-track). Builds throughout the session.

---

### 14. Post-Race Report Export

**What it does:** Two buttons — "Export CSV" and "Export JSON" — that download a report file to the steward's machine.

**CSV contents:**
- Header: track name, date
- Incidents table: time, type, drivers, status, notes
- Penalties table: driver, penalty type, time seconds, notes
- Driver summary: laps, contacts, off-tracks, blue flags, incident points, penalty count

**JSON contents:** Same data in structured JSON format for programmatic consumption (website integration, Discord bots, etc.).

---

### 15. Live Standings

**What it shows:** Full race standings table, switchable via the "Standings" tab:

| Column | What it shows |
|--------|-------------|
| Pos | Race position (gold for P1, white for podium) |
| # | Car number |
| Driver | Driver name |
| Laps | Laps completed |
| Interval | Gap to car directly ahead |
| Gap | Gap to race leader |
| Best Lap | Personal best (purple if overall fastest) |
| Last Lap | Most recent lap (green if personal best) |
| S1/S2/S3 | Sector times (purple = overall best sector, green = personal best) |
| iR | iRating (shown as "2.8k" format) |
| Pit | Amber "PIT" badge when on pit road |

**Interaction:** Click any driver row to switch the iRacing camera to that car (chase view).

---

## DRIVER FEATURES

### 16. Agent Connection

**What the driver does:** Launches the agent (.exe), enters their iRacing name, clicks Connect.

**What happens:** Agent connects to `ws://45.55.216.21/ws/agent`, reads iRacing's shared memory for driver info and track, sends `agent:hello`, then streams telemetry frames at 20Hz.

**Reconnection:** If the connection drops, the agent automatically retries every 3 seconds. The server deduplicates reconnecting drivers by name.

---

### 17. Penalty Overlay Notifications

**What the driver sees:** When a steward issues a decision involving them, a transparent overlay banner appears over their iRacing window:

- Top-center position (below iRacing's own HUD at y=60px)
- 92% opacity dark background
- Colored accent stripe at top (red/amber/blue/green matching severity)
- "RACE CONTROL" header
- Penalty text in large bold colored font
- Steward notes below (if any)
- Auto-fades after 8 seconds
- Click anywhere on the overlay to dismiss early

**All overlay types:**
- "INCIDENT UNDER INVESTIGATION" (amber) — when steward starts reviewing
- "DRIVE-THROUGH PENALTY" (red) — with notes
- "STOP & GO PENALTY" (red) — with notes
- "TIME PENALTY — 10s" (red) — with seconds shown
- "WARNING" (amber) — with notes
- "RACE INCIDENT" (blue) — no penalty
- "NO ACTION" (green) — cleared
- "DISQUALIFIED" (dark red) — with notes
- "PROTEST RECEIVED — STEWARDS NOTIFIED" (white) — protest acknowledgment
- Race control messages (color auto-detected from content)

---

### 18. Incident Reporting (Protest)

**What the driver does:** Presses F1 or clicks "Report Incident" in the agent window.

**What happens:** The agent captures the exact `sessionTime`, `lap`, and `lapDist` and sends it to the server. The button grays out for 10 seconds ("Reported!") to prevent spam. The driver gets a confirmation overlay.

**On the steward side:** A "PROTEST" incident appears in the feed at the exact moment the driver flagged. The steward can click Review to pull up telemetry and replay at that sessionTime.

---

## BROADCAST FEATURES

### 19. Broadcast Dashboard

**What it is:** A full-screen web dashboard at `http://45.55.216.21` designed for the broadcast crew to monitor the race.

**Layout:** Six panels in a grid:
1. **Live Standings** (main area) — full timing tower with position, car #, driver, laps, interval, gap, best/last lap, sector times, pit status
2. **Track Map** (top right) — circuit outline with live car position dots
3. **Battle Tracker** (bottom right) — auto-detects cars within 1.5s of each other, sorted by gap, red highlight for gaps < 0.5s
4. **Session Timer** (bottom left) — large remaining time countdown + elapsed time. Amber when < 10min remaining, red when < 2min
5. **Race Feed** (bottom center) — live event ticker with every incident, penalty, protest, contact, blue flag, fastest lap, and RC message. Status bar at top shows active counts ("2 under review | 1 penalty pending | 3 contacts")
6. **Live Telemetry** (bottom right) — mini telemetry cards for up to 6 drivers showing speed, gear, throttle/brake bars, current/best lap time

**Read-only:** No controls exposed. The broadcast crew sees everything but can't affect anything.

---

### 20. Battle Tracker

**What it does:** Automatically identifies close battles on track.

**Detection:** Scans the standings for any pair of consecutive cars where the interval is ≤ 1.5 seconds.

**Display:** Each battle shows the two drivers, their positions, and the gap between them. Sorted by gap (closest first).

**Hot battles:** Gaps < 0.5s are highlighted in red — these are the most exciting on-screen battles for the broadcast.

---

### 21. Race Feed (Broadcast)

**What it shows:** A chronological feed of every race event, filtered to broadcast-relevant items:

| Tag | Color | Event |
|-----|-------|-------|
| INC | Amber | Incident detected (+Xx) |
| CONTACT | Red | Probable car contact |
| BLUE | Blue | Blue flag violation |
| INV | Amber | Under investigation |
| PENALTY | Red | Penalty issued |
| SERVED | Green | Penalty served |
| PROTEST | Amber | Driver filed protest |
| RC | White | Race control message |
| FAST | Purple | New fastest lap |
| JOIN | Green | Driver connected |
| LEFT | Gray | Driver disconnected |

**Status bar:** Persistent summary at top when counts are non-zero: "2 under review | 1 penalty pending | 3 contacts | 5 inc". Disappears when everything is clear.

---

## SESSION RECORDING

### 22. NDJSON Persistence

**What it does:** Records every telemetry frame, lap, incident, penalty, and event to a per-session NDJSON file on the server.

**When it starts:** Automatically on the first agent connection with track info.

**File location:** `data/sessions/{timestamp}_{trackName}.ndjson`

**What's recorded:**
| Record type | When | Data |
|-------------|------|------|
| `session` | Session start | Track name, track ID, track length |
| `driver` | Driver joins | Driver ID, name, car |
| `frame` | Every frame (20Hz per driver) | Full telemetry object |
| `lap` | Lap completion | Lap number, time, fuel, valid, sectors |
| `incident` | Incident count change | Driver, delta, total, sessionTime |
| `penalty` | Penalty issued | Driver, type, seconds, notes |
| `driver_left` | Driver disconnect | Driver ID, name |
| `event` | Any event | Event type, data |
| `contact` | Contact detected | Both drivers, lat-G values |
| `blue_flag` | Blue flag violation | Both drivers, duration |
| `penalty_served` | Penalty served | Driver, penalty type |
| `rc_message` | Race control message | Message text, target |
| `driver_protest` | Driver protest | Driver, reason, sessionTime |

**Key abbreviations:** `t` = record type, `ts` = wall-clock timestamp, `d` = driverId, `st` = sessionTime, `ln` = lapNumber, `lt` = lapTime. Minimizes file size at 20Hz write rate.

**Use cases:** Post-race review, generating reports, historical statistics, replaying entire sessions, investigating incidents that were missed live.
