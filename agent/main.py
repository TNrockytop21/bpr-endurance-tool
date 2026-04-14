"""
iRacing Telemetry Capture Agent

Reads telemetry from iRacing shared memory and sends it to the telemetry server
via WebSocket. Use --mock to generate synthetic data without iRacing running.

Usage:
    python main.py                          # connect to iRacing
    python main.py --mock                   # synthetic data
    python main.py --server ws://host:8080/ws/agent
    python main.py --name "Driver Name"
"""

import argparse
import asyncio
import json
import math
import random
import time

import websockets

from config import SERVER_URL, DRIVER_NAME, SEND_RATE_HZ
from protocol import hello_message, frame_message, standings_message


# ---------------------------------------------------------------------------
# Mock telemetry generator (for testing without iRacing)
# ---------------------------------------------------------------------------

class MockIRacing:
    """Generates realistic Sebring telemetry for testing."""

    # Sebring International Raceway corner map
    # Each entry: (dist%, zone_type, min_speed_mph, steer_deg, gear)
    # zone_type: 'brake' = hard braking, 'corner' = mid-corner, 'accel' = corner exit
    SEBRING_CORNERS = [
        # T1 - hard right after main straight
        (0.065, 'brake', 65, -40, 2),
        (0.085, 'corner', 60, -60, 2),
        (0.105, 'accel', 75, -30, 3),
        # T2 - slight left kink
        (0.135, 'corner', 100, 20, 4),
        # T3 - hard left
        (0.175, 'brake', 55, 50, 2),
        (0.195, 'corner', 50, 70, 2),
        (0.215, 'accel', 70, 35, 3),
        # T4/5 - esses
        (0.260, 'brake', 80, -30, 3),
        (0.280, 'corner', 75, -45, 3),
        (0.300, 'corner', 80, 40, 3),
        (0.320, 'accel', 95, 15, 4),
        # T6 - not used on this config
        # T7 - hairpin
        (0.380, 'brake', 40, 60, 2),
        (0.405, 'corner', 35, 80, 1),
        (0.430, 'accel', 55, 40, 2),
        # Back straight - fast
        # T10 - hard right
        (0.530, 'brake', 60, -50, 2),
        (0.555, 'corner', 55, -65, 2),
        (0.575, 'accel', 80, -25, 3),
        # T11 - left
        (0.610, 'brake', 70, 35, 3),
        (0.630, 'corner', 65, 50, 3),
        (0.650, 'accel', 85, 20, 3),
        # T12/13 - fast kinks
        (0.700, 'corner', 105, -25, 4),
        (0.730, 'corner', 100, 20, 4),
        # T14/15 - Sunset Bend into last corner
        (0.800, 'brake', 70, -40, 3),
        (0.825, 'corner', 65, -55, 3),
        (0.850, 'accel', 80, -25, 3),
        # T16/17 - final corners before pit straight
        (0.900, 'brake', 55, 45, 2),
        (0.920, 'corner', 50, 60, 2),
        (0.945, 'accel', 70, 30, 3),
    ]

    def __init__(self):
        self.t = 0.0
        self.lap = 1
        self.lap_dist = 0.0
        self.lap_time = 0.0
        self.fuel = 60.0  # GT3 typical tank
        self.lap_start_time = time.time()
        self._lap_duration = 120.0 + random.uniform(-2, 2)  # ~2:00 lap
        self._speed_mph = 80.0
        self._steer = 0.0
        self._mock_drivers = [
            {"name": "D. Newman", "carNum": "1", "iRating": 3400, "baseLap": 120.98},
            {"name": "A. Riegel", "carNum": "2", "iRating": 2800, "baseLap": 121.23},
            {"name": "D. Morad", "carNum": "3", "iRating": 2900, "baseLap": 120.83},
            {"name": "F. Mengual", "carNum": "4", "iRating": 2800, "baseLap": 121.26},
            {"name": "A. William", "carNum": "5", "iRating": 3100, "baseLap": 121.56},
            {"name": "A. Kirsis", "carNum": "6", "iRating": 3200, "baseLap": 121.46},
            {"name": "L. Ludtke", "carNum": "7", "iRating": 2900, "baseLap": 121.35},
            {"name": "M. Pagliaro", "carNum": "8", "iRating": 3000, "baseLap": 121.26},
            {"name": "S. Kortnatowski", "carNum": "9", "iRating": 2800, "baseLap": 121.19},
            {"name": "A. Motta", "carNum": "10", "iRating": 2800, "baseLap": 121.49},
            {"name": "N. Klaes", "carNum": "11", "iRating": 2700, "baseLap": 121.28},
        ]
        # Pre-generate best laps and state per mock driver
        for d in self._mock_drivers:
            d["bestLap"] = d["baseLap"] + random.uniform(-0.5, 0.5)
            d["lastLap"] = d["baseLap"] + random.uniform(-0.3, 1.5)
            d["laps"] = 5
            d["dist"] = random.random()
            d["onPit"] = False

    def get_standings(self, player_name):
        """Generate mock standings for all cars."""
        standings = []
        # Update mock driver state
        for d in self._mock_drivers:
            d["dist"] += random.uniform(0.007, 0.009)
            if d["dist"] >= 1.0:
                d["dist"] -= 1.0
                d["laps"] += 1
                d["lastLap"] = d["baseLap"] + random.uniform(-0.5, 2.0)
                if d["lastLap"] < d["bestLap"]:
                    d["bestLap"] = d["lastLap"]
            d["onPit"] = d["dist"] > 0.95 or d["dist"] < 0.02

        # Add player
        all_cars = self._mock_drivers + [{
            "name": player_name, "carNum": "12", "iRating": 2800,
            "bestLap": 121.67, "lastLap": 121.69,
            "laps": self.lap, "dist": self.lap_dist, "onPit": False,
        }]

        # Sort by laps desc then dist desc for position
        all_cars.sort(key=lambda x: (-x["laps"], -x["dist"]))
        leader_laps = all_cars[0]["laps"]
        leader_dist = all_cars[0]["dist"]

        for i, d in enumerate(all_cars):
            gap = 0.0
            interval = 0.0
            if i > 0:
                lap_diff = leader_laps - d["laps"]
                gap = lap_diff * 120 + (leader_dist - d["dist"]) * 120
                prev = all_cars[i - 1]
                prev_lap_diff = prev["laps"] - d["laps"]
                interval = prev_lap_diff * 120 + (prev["dist"] - d["dist"]) * 120

            s1 = d.get("lastLap", 121) * 0.28 + random.uniform(-0.3, 0.3)
            s2 = d.get("lastLap", 121) * 0.38 + random.uniform(-0.3, 0.3)
            s3 = d.get("lastLap", 121) - s1 - s2

            standings.append({
                "pos": i + 1,
                "name": d["name"],
                "carNum": d.get("carNum", ""),
                "iRating": d.get("iRating", 0),
                "bestLap": d.get("bestLap"),
                "lastLap": d.get("lastLap"),
                "s1": round(s1, 2),
                "s2": round(s2, 2),
                "s3": round(s3, 2),
                "lapsCompleted": d["laps"],
                "onPitRoad": d.get("onPit", False),
                "interval": round(interval, 1),
                "gap": round(gap, 1),
            })
        return standings

    def _get_zone(self, pos):
        """Find current track zone based on position."""
        best = None
        best_dist = 999
        for (cdist, ctype, cspeed, csteer, cgear) in self.SEBRING_CORNERS:
            d = abs(pos - cdist)
            if d < 0.025 and d < best_dist:
                best = (ctype, cspeed, csteer, cgear)
                best_dist = d
        return best

    def tick(self, dt):
        self.t += dt
        self.lap_time += dt

        speed_factor = 1.0 / self._lap_duration
        self.lap_dist += speed_factor * dt
        self.fuel -= 0.035 * dt  # ~2.5L per lap at 2 min

        if self.lap_dist >= 1.0:
            self.lap_dist -= 1.0
            self.lap += 1
            self.lap_time = 0.0
            self._lap_duration = 120.0 + random.uniform(-2, 2)

        pos = self.lap_dist
        zone = self._get_zone(pos)

        if zone:
            ztype, min_speed, steer_target, gear = zone
            noise = random.uniform(-3, 3)
            if ztype == 'brake':
                throttle = random.uniform(0.0, 0.05)
                brake = random.uniform(0.7, 1.0)
                target_speed = min_speed + noise
            elif ztype == 'corner':
                throttle = random.uniform(0.2, 0.55)
                brake = random.uniform(0.0, 0.2)
                target_speed = min_speed + noise
            else:  # accel
                throttle = random.uniform(0.6, 0.95)
                brake = 0.0
                target_speed = min_speed + 10 + noise
            self._steer += (steer_target - self._steer) * 0.3
            target_gear = gear
        else:
            # On a straight
            throttle = random.uniform(0.95, 1.0)
            brake = 0.0
            target_speed = 145 + random.uniform(-3, 3)
            self._steer *= 0.85  # return to center
            target_gear = 5

        # Smooth speed transitions
        self._speed_mph += (target_speed - self._speed_mph) * 0.15
        speed_ms = self._speed_mph * 0.44704  # mph to m/s

        # RPM from speed and gear ratios
        gear_ratios = [0, 3.5, 2.4, 1.8, 1.4, 1.1, 0.9]
        g = max(1, min(6, target_gear))
        base_rpm = speed_ms * gear_ratios[g] * 28
        rpm = int(max(3800, min(7800, base_rpm + random.uniform(-100, 100))))

        steer_rad = math.radians(self._steer)
        lat_g = (speed_ms ** 2) * math.sin(steer_rad * 0.02) * 0.15
        lon_g = -brake * 2.8 + throttle * 1.2

        return {
            "lap": self.lap,
            "lapDist": self.lap_dist,
            "lapTime": self.lap_time,
            "throttle": throttle,
            "brake": brake,
            "speed": max(8, speed_ms),
            "rpm": rpm,
            "gear": g,
            "steer": self._steer + random.uniform(-1.5, 1.5),
            "latG": lat_g + random.uniform(-0.15, 0.15),
            "lonG": lon_g + random.uniform(-0.1, 0.1),
            "fuel": max(0, self.fuel),
            "onPitRoad": False,
            "position": 1,
            "sessionTime": self.t,
            "sessionTimeRemain": 43200 - self.t,  # 12hr race
            # Engine
            "waterTemp": 85 + throttle * 6 + random.uniform(-0.3, 0.3),
            "oilTemp": 100 + throttle * 10 + random.uniform(-0.3, 0.3),
            "oilPress": 4.8 + throttle * 1.2 + random.uniform(-0.1, 0.1),
            "voltage": 13.9 + random.uniform(-0.1, 0.1),
            "fuelPress": 390 + random.uniform(-5, 5),
            "fuelUsePerHour": 25 + throttle * 12 + random.uniform(-0.5, 0.5),
            # Environment
            "airTemp": 28 + random.uniform(-0.1, 0.1),
            "trackTemp": 38 + random.uniform(-0.2, 0.2),
            "incidents": 0,
            "lapDeltaToBest": random.uniform(-1.0, 1.5),
        }


# ---------------------------------------------------------------------------
# Main agent loop
# ---------------------------------------------------------------------------

async def _listen_server(ws):
    """Listen for incoming server messages (penalties, race control)."""
    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            msg_type = msg.get("type", "")
            payload = msg.get("payload", {})

            if msg_type == "server:penalty":
                penalty_type = payload.get("type", "unknown")
                time_sec = payload.get("timeSeconds")
                notes = payload.get("notes", "")
                label = penalty_type.upper().replace("-", " ")
                if time_sec and penalty_type == "time-penalty":
                    label = f"TIME PENALTY — {time_sec}s"
                print(f"\n{'='*50}")
                print(f"  RACE CONTROL: {label}")
                if notes:
                    print(f"  Note: {notes}")
                print(f"{'='*50}\n")
            elif msg_type == "server:underInvestigation":
                notes = payload.get("notes", "")
                print(f"\n{'='*50}")
                print(f"  RACE CONTROL: INCIDENT UNDER INVESTIGATION")
                if notes:
                    print(f"  Note: {notes}")
                print(f"{'='*50}\n")
            elif msg_type == "server:protestAck":
                print(f"\n  [RC] {payload.get('message', 'Protest received')}\n")
            elif msg_type == "server:message":
                print(f"\n  [RC] {payload.get('message', '')}\n")
    except asyncio.CancelledError:
        pass
    except Exception:
        pass


async def run_agent(server_url, driver_name, use_mock=False):
    while True:
        try:
            print(f"Connecting to {server_url}...")
            async with websockets.connect(server_url) as ws:
                print(f"Connected as {driver_name}")

                if use_mock:
                    ir = MockIRacing()
                    car = "Porsche 911 GT3 R"
                    track_name = "Sebring International Raceway"
                    track_id = 237
                else:
                    import irsdk
                    ir = irsdk.IRSDK()
                    ir.startup()

                    if not ir.is_connected:
                        print("Waiting for iRacing...")
                        while not ir.is_connected:
                            ir.startup()
                            await asyncio.sleep(1)
                        print("iRacing connected!")

                    from capture import get_driver_info, get_session_info
                    d_info = get_driver_info(ir)
                    s_info = get_session_info(ir)
                    driver_name = d_info["name"] if d_info["name"] != "Unknown" else driver_name
                    car = d_info["car"]
                    track_name = s_info["trackName"] if s_info else "Unknown"
                    track_id = s_info.get("trackId", 0) if s_info else 0

                # Send hello
                await ws.send(hello_message(driver_name, car, track_id, track_name))

                # Listen for server messages (penalties, race control)
                listen_task = asyncio.create_task(_listen_server(ws))

                interval = 1.0 / SEND_RATE_HZ
                frame_count = 0

                while True:
                    start = time.time()

                    if use_mock:
                        frame = ir.tick(interval)
                    else:
                        from capture import read_frame
                        if not ir.is_connected:
                            print("iRacing disconnected")
                            break
                        frame = read_frame(ir)

                    await ws.send(frame_message(frame))
                    frame_count += 1

                    # Send standings at 2Hz (every 10 frames at 20Hz)
                    if frame_count % 10 == 0:
                        if use_mock:
                            stdata = ir.get_standings(driver_name)
                        else:
                            from capture import read_standings
                            stdata = read_standings(ir)
                        if stdata:
                            await ws.send(standings_message(stdata))

                    if frame_count % (SEND_RATE_HZ * 5) == 0:
                        print(
                            f"  L{frame['lap']} | "
                            f"Dist: {frame['lapDist']:.1%} | "
                            f"T: {frame['throttle']:.0%} B: {frame['brake']:.0%} | "
                            f"Fuel: {frame['fuel']:.1f}L"
                        )

                    elapsed = time.time() - start
                    sleep_time = max(0, interval - elapsed)
                    await asyncio.sleep(sleep_time)

                listen_task.cancel()

        except (websockets.ConnectionClosed, ConnectionRefusedError, OSError) as e:
            print(f"Connection lost ({e}). Reconnecting in 3s...")
            await asyncio.sleep(3)


def main():
    parser = argparse.ArgumentParser(description="iRacing Telemetry Agent")
    parser.add_argument("--server", default=SERVER_URL, help="WebSocket server URL")
    parser.add_argument("--name", default=DRIVER_NAME, help="Driver name")
    parser.add_argument("--mock", action="store_true", help="Use mock telemetry data")
    args = parser.parse_args()

    print(f"iRacing Telemetry Agent")
    print(f"  Server: {args.server}")
    print(f"  Driver: {args.name}")
    print(f"  Mode:   {'Mock' if args.mock else 'iRacing'}")
    print()

    asyncio.run(run_agent(args.server, args.name, args.mock))


if __name__ == "__main__":
    main()
