"""
BPR Race Control — Multi-Bot Simulator

Spawns multiple mock drivers with different speeds, skill levels,
and incident rates. Run this to populate the broadcast dashboard
and steward app with realistic race data.

Usage:
    python bots.py              # 12 bots, default server
    python bots.py --count 6    # 6 bots
    python bots.py --server ws://localhost:8080/ws/agent
"""

import asyncio
import argparse
import json
import math
import random
import time

import websockets

from config import SERVER_URL, SEND_RATE_HZ
from protocol import hello_message, frame_message, standings_message

# Driver roster with different skill levels
DRIVERS = [
    {"name": "D. Newman",       "carNum": "1",  "car": "Porsche 911 GT3 R",        "iRating": 3400, "baseLap": 120.98, "skill": 0.95, "aggression": 0.3},
    {"name": "A. Riegel",       "carNum": "2",  "car": "BMW M4 GT3",               "iRating": 2800, "baseLap": 121.23, "skill": 0.85, "aggression": 0.5},
    {"name": "D. Morad",        "carNum": "3",  "car": "Ferrari 296 GT3",          "iRating": 2900, "baseLap": 120.83, "skill": 0.92, "aggression": 0.4},
    {"name": "F. Mengual",      "carNum": "4",  "car": "Mercedes-AMG GT3",         "iRating": 2800, "baseLap": 121.26, "skill": 0.82, "aggression": 0.6},
    {"name": "A. William",      "carNum": "5",  "car": "Audi R8 LMS GT3",         "iRating": 3100, "baseLap": 121.56, "skill": 0.88, "aggression": 0.35},
    {"name": "A. Kirsis",       "carNum": "6",  "car": "Lamborghini Huracan GT3",  "iRating": 3200, "baseLap": 121.46, "skill": 0.90, "aggression": 0.25},
    {"name": "L. Ludtke",       "carNum": "7",  "car": "Porsche 911 GT3 R",        "iRating": 2900, "baseLap": 121.35, "skill": 0.83, "aggression": 0.55},
    {"name": "M. Pagliaro",     "carNum": "8",  "car": "McLaren 720S GT3",         "iRating": 3000, "baseLap": 121.26, "skill": 0.87, "aggression": 0.45},
    {"name": "S. Kortnatowski", "carNum": "9",  "car": "BMW M4 GT3",               "iRating": 2800, "baseLap": 121.19, "skill": 0.80, "aggression": 0.7},
    {"name": "A. Motta",        "carNum": "10", "car": "Ferrari 296 GT3",          "iRating": 2800, "baseLap": 121.49, "skill": 0.84, "aggression": 0.5},
    {"name": "N. Klaes",        "carNum": "11", "car": "Audi R8 LMS GT3",         "iRating": 2700, "baseLap": 121.28, "skill": 0.78, "aggression": 0.65},
    {"name": "T. Avalon",       "carNum": "12", "car": "Mercedes-AMG GT3",         "iRating": 2600, "baseLap": 122.10, "skill": 0.75, "aggression": 0.8},
]

# Sebring corner map (shared with MockIRacing)
SEBRING_CORNERS = [
    (0.065, 'brake', 65, -40, 2), (0.085, 'corner', 60, -60, 2), (0.105, 'accel', 75, -30, 3),
    (0.135, 'corner', 100, 20, 4),
    (0.175, 'brake', 55, 50, 2), (0.195, 'corner', 50, 70, 2), (0.215, 'accel', 70, 35, 3),
    (0.260, 'brake', 80, -30, 3), (0.280, 'corner', 75, -45, 3), (0.300, 'corner', 80, 40, 3), (0.320, 'accel', 95, 15, 4),
    (0.380, 'brake', 40, 60, 2), (0.405, 'corner', 35, 80, 1), (0.430, 'accel', 55, 40, 2),
    (0.530, 'brake', 60, -50, 2), (0.555, 'corner', 55, -65, 2), (0.575, 'accel', 80, -25, 3),
    (0.610, 'brake', 70, 35, 3), (0.630, 'corner', 65, 50, 3), (0.650, 'accel', 85, 20, 3),
    (0.700, 'corner', 105, -25, 4), (0.730, 'corner', 100, 20, 4),
    (0.800, 'brake', 70, -40, 3), (0.825, 'corner', 65, -55, 3), (0.850, 'accel', 80, -25, 3),
    (0.900, 'brake', 55, 45, 2), (0.920, 'corner', 50, 60, 2), (0.945, 'accel', 70, 30, 3),
]


class BotDriver:
    """Simulates one driver with configurable speed and behavior."""

    def __init__(self, driver_info, start_offset=0):
        self.info = driver_info
        self.name = driver_info["name"]
        self.car = driver_info["car"]
        self.skill = driver_info["skill"]
        self.aggression = driver_info["aggression"]

        self.t = start_offset
        self.lap = 1
        self.lap_dist = random.uniform(0, 0.3)  # stagger starting positions
        self.lap_time = 0.0
        self.fuel = 60.0
        self._speed_mph = 80.0
        self._steer = 0.0
        self._incident_count = 0

        # Skill affects lap time variation and consistency
        base = driver_info["baseLap"]
        self._lap_duration = base + random.uniform(-1, 3) * (1 - self.skill)

        # Incident timing — more aggressive = more frequent
        self._next_incident_time = self.t + random.uniform(40, 120) * (1 - self.aggression + 0.3)
        self._contact_active = False
        self._contact_end_time = 0

    def _get_zone(self, pos):
        best = None
        best_dist = 999
        for (cdist, ctype, cspeed, csteer, cgear) in SEBRING_CORNERS:
            d = abs(pos - cdist)
            if d < 0.025 and d < best_dist:
                best = (ctype, cspeed, csteer, cgear)
                best_dist = d
        return best

    def tick(self, dt):
        self.t += dt
        self.lap_time += dt

        # Speed varies by skill — better drivers are faster and more consistent
        speed_factor = (1.0 / self._lap_duration) * (0.95 + self.skill * 0.1)
        self.lap_dist += speed_factor * dt
        self.fuel -= 0.035 * dt

        if self.lap_dist >= 1.0:
            self.lap_dist -= 1.0
            self.lap += 1
            self.lap_time = 0.0
            # Lap time variation — less skilled = more variation
            base = self.info["baseLap"]
            variation = random.uniform(-0.5, 3.0) * (1.2 - self.skill)
            self._lap_duration = base + variation

        pos = self.lap_dist
        zone = self._get_zone(pos)
        rng = lambda: random.random()

        if zone:
            ztype, min_speed, steer_target, gear = zone
            noise = random.uniform(-3, 3) * (1.2 - self.skill)
            if ztype == 'brake':
                throttle = random.uniform(0.0, 0.05)
                brake = random.uniform(0.7, 1.0)
                target_speed = min_speed + noise
            elif ztype == 'corner':
                throttle = random.uniform(0.2, 0.55)
                brake = random.uniform(0.0, 0.2)
                target_speed = min_speed + noise
            else:
                throttle = random.uniform(0.6, 0.95)
                brake = 0.0
                target_speed = min_speed + 10 + noise
            self._steer += (steer_target - self._steer) * (0.2 + self.skill * 0.15)
            target_gear = gear
        else:
            throttle = random.uniform(0.95, 1.0)
            brake = 0.0
            target_speed = 145 + random.uniform(-3, 3)
            self._steer *= 0.85
            target_gear = 5

        self._speed_mph += (target_speed - self._speed_mph) * 0.15
        speed_ms = self._speed_mph * 0.44704

        gear_ratios = [0, 3.5, 2.4, 1.8, 1.4, 1.1, 0.9]
        g = max(1, min(6, target_gear))
        base_rpm = speed_ms * gear_ratios[g] * 28
        rpm = int(max(3800, min(7800, base_rpm + random.uniform(-100, 100))))

        steer_rad = math.radians(self._steer)
        lat_g = (speed_ms ** 2) * math.sin(steer_rad * 0.02) * 0.15
        lon_g = -brake * 2.8 + throttle * 1.2

        # Random incidents
        if self.t >= self._next_incident_time:
            # More aggressive drivers get more 2x/4x, less aggressive get more 1x
            if random.random() < self.aggression:
                delta = random.choice([2, 2, 4])
            else:
                delta = 1
            self._incident_count += delta
            self._next_incident_time = self.t + random.uniform(30, 100) * (1.3 - self.aggression)
            if delta >= 2:
                self._contact_active = True
                self._contact_end_time = self.t + 0.5
            print(f"  [{self.name}] +{delta}x @ {self.t:.0f}s (total: {self._incident_count})")

        # Contact lat-G spike
        if self._contact_active:
            lat_g = random.choice([-1, 1]) * random.uniform(2.0, 3.5)
            self._steer += random.uniform(-30, 30)
            if self.t >= self._contact_end_time:
                self._contact_active = False

        return {
            "lap": self.lap,
            "lapDist": self.lap_dist,
            "lapTime": self.lap_time,
            "throttle": max(0, min(1, throttle)),
            "brake": max(0, min(1, brake)),
            "speed": max(8, speed_ms),
            "rpm": rpm,
            "gear": g,
            "steer": self._steer + random.uniform(-1.5, 1.5) * (1.3 - self.skill),
            "latG": lat_g + random.uniform(-0.15, 0.15),
            "lonG": lon_g + random.uniform(-0.1, 0.1),
            "fuel": max(0, self.fuel),
            "onPitRoad": False,
            "position": 1,
            "sessionTime": self.t,
            "sessionTimeRemain": 43200 - self.t,
            "waterTemp": 85 + throttle * 6 + random.uniform(-0.3, 0.3),
            "oilTemp": 100 + throttle * 10 + random.uniform(-0.3, 0.3),
            "oilPress": 4.8 + throttle * 1.2 + random.uniform(-0.1, 0.1),
            "voltage": 13.9 + random.uniform(-0.1, 0.1),
            "fuelPress": 390 + random.uniform(-5, 5),
            "fuelUsePerHour": 25 + throttle * 12 + random.uniform(-0.5, 0.5),
            "airTemp": 28 + random.uniform(-0.1, 0.1),
            "trackTemp": 38 + random.uniform(-0.2, 0.2),
            "incidents": self._incident_count,
            "lapDeltaToBest": random.uniform(-1.0, 1.5),
        }

    def get_standings(self, all_bots):
        """Generate standings from all bots' current state."""
        cars = []
        for bot in all_bots:
            cars.append({
                "name": bot.name,
                "carNum": bot.info["carNum"],
                "iRating": bot.info["iRating"],
                "bestLap": bot.info["baseLap"] + random.uniform(-0.5, 0.5),
                "lastLap": bot._lap_duration + random.uniform(-0.3, 0.5),
                "laps": bot.lap,
                "dist": bot.lap_dist,
                "onPit": False,
            })

        cars.sort(key=lambda x: (-x["laps"], -x["dist"]))
        leader_laps = cars[0]["laps"]
        leader_dist = cars[0]["dist"]

        standings = []
        for i, d in enumerate(cars):
            gap = 0.0
            interval = 0.0
            if i > 0:
                lap_diff = leader_laps - d["laps"]
                gap = lap_diff * 120 + (leader_dist - d["dist"]) * 120
                prev = cars[i - 1]
                prev_lap_diff = prev["laps"] - d["laps"]
                interval = prev_lap_diff * 120 + (prev["dist"] - d["dist"]) * 120

            s1 = d["lastLap"] * 0.28 + random.uniform(-0.3, 0.3)
            s2 = d["lastLap"] * 0.38 + random.uniform(-0.3, 0.3)
            s3 = d["lastLap"] - s1 - s2

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
                "interval": round(max(0, interval), 1),
                "gap": round(max(0, gap), 1),
            })
        return standings


async def run_bot(server_url, bot, all_bots):
    """Run one bot driver as a websocket agent."""
    while True:
        try:
            async with websockets.connect(server_url) as ws:
                print(f"[{bot.name}] connected")
                await ws.send(hello_message(bot.name, bot.car, 237, "Sebring International Raceway"))

                interval = 1.0 / SEND_RATE_HZ
                frame_count = 0

                while True:
                    start = time.time()
                    frame = bot.tick(interval)
                    await ws.send(frame_message(frame))
                    frame_count += 1

                    # First bot sends standings at 2Hz
                    if bot is all_bots[0] and frame_count % 10 == 0:
                        stdata = bot.get_standings(all_bots)
                        await ws.send(standings_message(stdata))

                    elapsed = time.time() - start
                    await asyncio.sleep(max(0, interval - elapsed))

        except (websockets.ConnectionClosed, ConnectionRefusedError, OSError) as e:
            print(f"[{bot.name}] disconnected ({e}), reconnecting...")
            await asyncio.sleep(3)


async def main(server_url, count):
    drivers = DRIVERS[:count]
    bots = [BotDriver(d, start_offset=random.uniform(0, 5)) for d in drivers]

    print(f"BPR Race Control — Bot Simulator")
    print(f"  Server: {server_url}")
    print(f"  Bots:   {count}")
    print(f"  Track:  Sebring International Raceway")
    print()
    for bot in bots:
        print(f"  #{bot.info['carNum']:>2}  {bot.name:<20} {bot.car:<28} skill={bot.skill:.2f}  aggro={bot.aggression:.2f}")
    print()

    tasks = [asyncio.create_task(run_bot(server_url, bot, bots)) for bot in bots]
    await asyncio.gather(*tasks)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BPR Multi-Bot Simulator")
    parser.add_argument("--server", default=SERVER_URL, help="WebSocket server URL")
    parser.add_argument("--count", type=int, default=12, help="Number of bots (max 12)")
    args = parser.parse_args()

    asyncio.run(main(args.server, min(args.count, len(DRIVERS))))
