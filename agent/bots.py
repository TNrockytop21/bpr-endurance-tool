"""
BPR Race Control — Multi-Class Bot Simulator

Spawns 55 mock drivers: 35 GT3 + 20 LMP2 with different speeds,
skill levels, and incident rates. LMP2 cars are ~10s/lap faster.

Usage:
    python bots.py                          # all 55 bots
    python bots.py --gt3 10 --lmp2 5        # custom counts
    python bots.py --server ws://localhost:8080/ws/agent
"""

import asyncio
import argparse
import math
import random
import time

import websockets

from config import SERVER_URL, SEND_RATE_HZ
from protocol import hello_message, frame_message, standings_message

# ──────────────────────────────────────────────────────────────
# GT3 Roster — 35 drivers, lap ~120-124s at Sebring
# ──────────────────────────────────────────────────────────────
GT3_CARS = [
    "Porsche 911 GT3 R", "BMW M4 GT3", "Ferrari 296 GT3",
    "Mercedes-AMG GT3", "Audi R8 LMS GT3", "Lamborghini Huracan GT3",
    "McLaren 720S GT3", "Aston Martin Vantage GT3",
]

GT3_DRIVERS = [
    # Top tier (fast, clean)
    {"name": "D. Newman",       "carNum": "1",  "iRating": 4200, "baseLap": 120.5, "skill": 0.97, "aggression": 0.20},
    {"name": "D. Morad",        "carNum": "3",  "iRating": 4000, "baseLap": 120.8, "skill": 0.95, "aggression": 0.25},
    {"name": "J. Krohn",        "carNum": "14", "iRating": 3900, "baseLap": 120.9, "skill": 0.94, "aggression": 0.22},
    {"name": "R. Westbrook",    "carNum": "15", "iRating": 3800, "baseLap": 121.0, "skill": 0.93, "aggression": 0.28},
    {"name": "K. Estre",        "carNum": "16", "iRating": 3850, "baseLap": 120.7, "skill": 0.96, "aggression": 0.18},
    # Strong (fast, moderate risk)
    {"name": "A. Kirsis",       "carNum": "6",  "iRating": 3500, "baseLap": 121.2, "skill": 0.91, "aggression": 0.30},
    {"name": "A. William",      "carNum": "5",  "iRating": 3400, "baseLap": 121.4, "skill": 0.89, "aggression": 0.35},
    {"name": "M. Pagliaro",     "carNum": "8",  "iRating": 3300, "baseLap": 121.3, "skill": 0.88, "aggression": 0.40},
    {"name": "P. Eng",          "carNum": "17", "iRating": 3600, "baseLap": 121.1, "skill": 0.90, "aggression": 0.32},
    {"name": "N. Catsburg",     "carNum": "18", "iRating": 3550, "baseLap": 121.0, "skill": 0.92, "aggression": 0.28},
    {"name": "M. Jaminet",      "carNum": "19", "iRating": 3700, "baseLap": 120.9, "skill": 0.93, "aggression": 0.25},
    {"name": "T. Vautier",      "carNum": "20", "iRating": 3450, "baseLap": 121.3, "skill": 0.89, "aggression": 0.38},
    # Mid-pack (solid, some incidents)
    {"name": "A. Riegel",       "carNum": "2",  "iRating": 2800, "baseLap": 121.8, "skill": 0.85, "aggression": 0.50},
    {"name": "F. Mengual",      "carNum": "4",  "iRating": 2900, "baseLap": 121.9, "skill": 0.83, "aggression": 0.55},
    {"name": "L. Ludtke",       "carNum": "7",  "iRating": 2700, "baseLap": 122.0, "skill": 0.82, "aggression": 0.52},
    {"name": "A. Motta",        "carNum": "10", "iRating": 2800, "baseLap": 121.7, "skill": 0.84, "aggression": 0.48},
    {"name": "R. Breukers",     "carNum": "21", "iRating": 2750, "baseLap": 122.1, "skill": 0.81, "aggression": 0.50},
    {"name": "C. Haase",        "carNum": "22", "iRating": 2850, "baseLap": 121.6, "skill": 0.86, "aggression": 0.42},
    {"name": "B. Barker",       "carNum": "23", "iRating": 2900, "baseLap": 121.5, "skill": 0.87, "aggression": 0.38},
    {"name": "D. Pittard",      "carNum": "24", "iRating": 2800, "baseLap": 121.9, "skill": 0.83, "aggression": 0.55},
    {"name": "F. Perera",       "carNum": "25", "iRating": 3000, "baseLap": 121.4, "skill": 0.88, "aggression": 0.35},
    {"name": "M. Bortolotti",   "carNum": "26", "iRating": 3100, "baseLap": 121.2, "skill": 0.90, "aggression": 0.30},
    # Back of field (slower, more incidents)
    {"name": "S. Kortnatowski", "carNum": "9",  "iRating": 2200, "baseLap": 122.8, "skill": 0.75, "aggression": 0.70},
    {"name": "N. Klaes",        "carNum": "11", "iRating": 2300, "baseLap": 122.5, "skill": 0.77, "aggression": 0.65},
    {"name": "T. Avalon",       "carNum": "12", "iRating": 2100, "baseLap": 123.0, "skill": 0.73, "aggression": 0.75},
    {"name": "J. Pepper",       "carNum": "27", "iRating": 2400, "baseLap": 122.4, "skill": 0.78, "aggression": 0.60},
    {"name": "R. Tomczyk",      "carNum": "28", "iRating": 2350, "baseLap": 122.6, "skill": 0.76, "aggression": 0.68},
    {"name": "M. Winkelhock",   "carNum": "29", "iRating": 2500, "baseLap": 122.2, "skill": 0.79, "aggression": 0.58},
    {"name": "G. Fisichella",   "carNum": "30", "iRating": 2600, "baseLap": 122.0, "skill": 0.80, "aggression": 0.52},
    {"name": "P. Lamy",         "carNum": "31", "iRating": 2150, "baseLap": 123.2, "skill": 0.72, "aggression": 0.72},
    {"name": "K. Bachler",      "carNum": "32", "iRating": 2250, "baseLap": 122.9, "skill": 0.74, "aggression": 0.70},
    {"name": "D. Serra",        "carNum": "33", "iRating": 2450, "baseLap": 122.3, "skill": 0.78, "aggression": 0.62},
    {"name": "L. Stolz",        "carNum": "34", "iRating": 2550, "baseLap": 122.1, "skill": 0.80, "aggression": 0.55},
    {"name": "C. Engelhart",    "carNum": "35", "iRating": 2000, "baseLap": 123.5, "skill": 0.70, "aggression": 0.80},
    {"name": "B. Schneider",    "carNum": "36", "iRating": 1900, "baseLap": 124.0, "skill": 0.68, "aggression": 0.85},
]

# ──────────────────────────────────────────────────────────────
# LMP2 Roster — 20 drivers, lap ~110-114s at Sebring (faster class)
# ──────────────────────────────────────────────────────────────
LMP2_CAR = "Dallara P217 LMP2"

LMP2_DRIVERS = [
    # Platinum/Gold (very fast, clean)
    {"name": "P. Hanson",       "carNum": "101", "iRating": 5200, "baseLap": 110.2, "skill": 0.97, "aggression": 0.20},
    {"name": "F. Albuquerque",  "carNum": "102", "iRating": 5000, "baseLap": 110.5, "skill": 0.96, "aggression": 0.22},
    {"name": "W. Owen",         "carNum": "103", "iRating": 4800, "baseLap": 110.8, "skill": 0.95, "aggression": 0.25},
    {"name": "N. de Vries",     "carNum": "104", "iRating": 5100, "baseLap": 110.3, "skill": 0.97, "aggression": 0.18},
    {"name": "J. Canal",        "carNum": "105", "iRating": 4700, "baseLap": 111.0, "skill": 0.94, "aggression": 0.28},
    {"name": "R. Gonzalez",     "carNum": "106", "iRating": 4600, "baseLap": 111.2, "skill": 0.93, "aggression": 0.30},
    {"name": "A. Brundle",      "carNum": "107", "iRating": 4500, "baseLap": 111.0, "skill": 0.94, "aggression": 0.25},
    # Silver (fast, moderate)
    {"name": "M. Patterson",    "carNum": "108", "iRating": 3800, "baseLap": 111.8, "skill": 0.90, "aggression": 0.35},
    {"name": "D. Heinemeier",   "carNum": "109", "iRating": 3700, "baseLap": 112.0, "skill": 0.89, "aggression": 0.40},
    {"name": "B. Keating",      "carNum": "110", "iRating": 3500, "baseLap": 112.3, "skill": 0.87, "aggression": 0.42},
    {"name": "S. Thomas",       "carNum": "111", "iRating": 3600, "baseLap": 112.1, "skill": 0.88, "aggression": 0.38},
    {"name": "R. Lacorte",      "carNum": "112", "iRating": 3400, "baseLap": 112.5, "skill": 0.86, "aggression": 0.45},
    {"name": "T. Caldwell",     "carNum": "113", "iRating": 3300, "baseLap": 112.8, "skill": 0.85, "aggression": 0.48},
    # Bronze (slower for class, more incidents)
    {"name": "G. Aubry",        "carNum": "114", "iRating": 2800, "baseLap": 113.2, "skill": 0.80, "aggression": 0.55},
    {"name": "C. Crews",        "carNum": "115", "iRating": 2700, "baseLap": 113.5, "skill": 0.78, "aggression": 0.60},
    {"name": "J. Falb",         "carNum": "116", "iRating": 2600, "baseLap": 113.8, "skill": 0.76, "aggression": 0.65},
    {"name": "D. Droux",        "carNum": "117", "iRating": 2500, "baseLap": 114.0, "skill": 0.74, "aggression": 0.68},
    {"name": "N. Lapierre",     "carNum": "118", "iRating": 2900, "baseLap": 113.0, "skill": 0.82, "aggression": 0.50},
    {"name": "H. Tincknell",    "carNum": "119", "iRating": 2400, "baseLap": 114.2, "skill": 0.72, "aggression": 0.72},
    {"name": "R. Binder",       "carNum": "120", "iRating": 2300, "baseLap": 114.5, "skill": 0.70, "aggression": 0.78},
]

# Sebring corner map — speeds are base GT3 speeds, LMP2 gets a multiplier
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

    def __init__(self, driver_info, car_class='GT3', start_offset=0):
        self.info = driver_info
        self.name = driver_info["name"]
        self.car = driver_info.get("car", LMP2_CAR if car_class == 'LMP2' else random.choice(GT3_CARS))
        self.car_class = car_class
        self.skill = driver_info["skill"]
        self.aggression = driver_info["aggression"]

        # LMP2 is ~8% faster through corners, higher top speed
        self.speed_multiplier = 1.08 if car_class == 'LMP2' else 1.0
        self.top_speed_bonus = 15 if car_class == 'LMP2' else 0

        self.t = start_offset
        self.lap = 1
        self.lap_dist = random.uniform(0, 0.3)
        self.lap_time = 0.0
        self.fuel = 60.0
        self._speed_mph = 80.0 * self.speed_multiplier
        self._steer = 0.0
        self._incident_count = 0

        base = driver_info["baseLap"]
        self._lap_duration = base + random.uniform(-1, 3) * (1 - self.skill)

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

        speed_factor = (1.0 / self._lap_duration) * (0.95 + self.skill * 0.1)
        self.lap_dist += speed_factor * dt
        self.fuel -= 0.035 * dt

        if self.lap_dist >= 1.0:
            self.lap_dist -= 1.0
            self.lap += 1
            self.lap_time = 0.0
            base = self.info["baseLap"]
            variation = random.uniform(-0.5, 3.0) * (1.2 - self.skill)
            self._lap_duration = base + variation

        pos = self.lap_dist
        zone = self._get_zone(pos)

        if zone:
            ztype, min_speed, steer_target, gear = zone
            min_speed *= self.speed_multiplier
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
            target_speed = (145 + self.top_speed_bonus) + random.uniform(-3, 3)
            self._steer *= 0.85
            target_gear = 5 if self.car_class == 'GT3' else 6

        self._speed_mph += (target_speed - self._speed_mph) * 0.15
        speed_ms = self._speed_mph * 0.44704

        gear_ratios = [0, 3.5, 2.4, 1.8, 1.4, 1.1, 0.9, 0.8]
        g = max(1, min(7 if self.car_class == 'LMP2' else 6, target_gear))
        base_rpm = speed_ms * gear_ratios[min(g, len(gear_ratios)-1)] * 28
        max_rpm = 8500 if self.car_class == 'LMP2' else 7800
        rpm = int(max(3800, min(max_rpm, base_rpm + random.uniform(-100, 100))))

        steer_rad = math.radians(self._steer)
        lat_g = (speed_ms ** 2) * math.sin(steer_rad * 0.02) * 0.15
        lon_g = -brake * 2.8 + throttle * 1.2
        # LMP2 has more downforce = higher cornering G
        if self.car_class == 'LMP2':
            lat_g *= 1.15

        # Random incidents
        if self.t >= self._next_incident_time:
            if random.random() < self.aggression:
                delta = random.choice([2, 2, 4])
            else:
                delta = 1
            self._incident_count += delta
            self._next_incident_time = self.t + random.uniform(30, 100) * (1.3 - self.aggression)
            if delta >= 2:
                self._contact_active = True
                self._contact_end_time = self.t + 0.5
            print(f"  [{self.car_class}] {self.name} +{delta}x @ {self.t:.0f}s (total: {self._incident_count})")

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
                "class": bot.car_class,
            })

        cars.sort(key=lambda x: (-x["laps"], -x["dist"]))
        leader_laps = cars[0]["laps"]
        leader_dist = cars[0]["dist"]

        standings = []
        for i, d in enumerate(cars):
            gap = 0.0
            interval = 0.0
            if i > 0:
                avg_lap = 115 if d["class"] == "LMP2" else 122
                lap_diff = leader_laps - d["laps"]
                gap = lap_diff * avg_lap + (leader_dist - d["dist"]) * avg_lap
                prev = cars[i - 1]
                prev_avg = 115 if prev["class"] == "LMP2" else 122
                prev_lap_diff = prev["laps"] - d["laps"]
                interval = prev_lap_diff * prev_avg + (prev["dist"] - d["dist"]) * prev_avg

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
                print(f"[{bot.car_class}] {bot.name} connected — {bot.car}")
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
            print(f"[{bot.car_class}] {bot.name} disconnected ({e}), reconnecting...")
            await asyncio.sleep(3)


async def main(server_url, gt3_count, lmp2_count):
    # Build driver lists
    gt3_list = GT3_DRIVERS[:gt3_count]
    for d in gt3_list:
        if "car" not in d:
            d["car"] = random.choice(GT3_CARS)

    lmp2_list = LMP2_DRIVERS[:lmp2_count]
    for d in lmp2_list:
        d["car"] = LMP2_CAR

    bots = []
    for d in gt3_list:
        bots.append(BotDriver(d, car_class='GT3', start_offset=random.uniform(0, 5)))
    for d in lmp2_list:
        bots.append(BotDriver(d, car_class='LMP2', start_offset=random.uniform(0, 5)))

    total = len(bots)
    print(f"BPR Race Control — Multi-Class Bot Simulator")
    print(f"  Server: {server_url}")
    print(f"  GT3:    {gt3_count} drivers (~120-124s/lap)")
    print(f"  LMP2:   {lmp2_count} drivers (~110-114s/lap)")
    print(f"  Total:  {total} cars")
    print(f"  Track:  Sebring International Raceway")
    print()
    print(f"  {'#':>3}  {'Driver':<20} {'Car':<28} {'Class':<5} {'Skill':>5}  {'Aggro':>5}")
    print(f"  {'─'*3}  {'─'*20} {'─'*28} {'─'*5} {'─'*5}  {'─'*5}")
    for bot in sorted(bots, key=lambda b: (b.car_class, -b.skill)):
        print(f"  {bot.info['carNum']:>3}  {bot.name:<20} {bot.car:<28} {bot.car_class:<5} {bot.skill:>5.2f}  {bot.aggression:>5.2f}")
    print()

    tasks = [asyncio.create_task(run_bot(server_url, bot, bots)) for bot in bots]
    await asyncio.gather(*tasks)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BPR Multi-Class Bot Simulator")
    parser.add_argument("--server", default=SERVER_URL, help="WebSocket server URL")
    parser.add_argument("--gt3", type=int, default=35, help="Number of GT3 bots (max 35)")
    parser.add_argument("--lmp2", type=int, default=20, help="Number of LMP2 bots (max 20)")
    args = parser.parse_args()

    asyncio.run(main(
        args.server,
        min(args.gt3, len(GT3_DRIVERS)),
        min(args.lmp2, len(LMP2_DRIVERS)),
    ))
