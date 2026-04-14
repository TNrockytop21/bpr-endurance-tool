import math

def read_frame(ir):
    """Read a telemetry frame from iRacing shared memory."""
    frame = {
        # Core driving
        "lap": ir["Lap"],
        "lapDist": ir["LapDistPct"],
        "lapTime": ir["LapCurrentLapTime"],
        "throttle": ir["Throttle"],
        "brake": ir["Brake"],
        "speed": ir["Speed"],
        "rpm": ir["RPM"],
        "gear": ir["Gear"],
        "steer": math.degrees(ir["SteeringWheelAngle"]),
        "latG": ir["LatAccel"],
        "lonG": ir["LongAccel"],
        "fuel": ir["FuelLevel"],
        "onPitRoad": bool(ir["OnPitRoad"]),
        "position": ir["PlayerCarPosition"],
        "sessionTime": ir["SessionTime"],
        "sessionTimeRemain": ir["SessionTimeRemain"],
    }

    # NOTE: Tire temps, wear, brake temps, and shock data are restricted by
    # iRacing's API and not reliably available, so we don't capture them.

    # Engine / Drivetrain
    try:
        frame["waterTemp"] = ir["WaterTemp"]
    except Exception:
        pass
    try:
        frame["oilTemp"] = ir["OilTemp"]
    except Exception:
        pass
    try:
        frame["oilPress"] = ir["OilPress"]
    except Exception:
        pass
    try:
        frame["voltage"] = ir["Voltage"]
    except Exception:
        pass
    try:
        frame["fuelPress"] = ir["FuelPress"]
    except Exception:
        pass
    try:
        frame["fuelUsePerHour"] = ir["FuelUsePerHour"]
    except Exception:
        pass
    try:
        frame["clutch"] = ir["Clutch"]
    except Exception:
        pass

    # Brake/ABS/TC
    try:
        frame["brakeRaw"] = ir["BrakeRaw"]
    except Exception:
        pass
    try:
        frame["abs"] = ir["dcABS"]
    except Exception:
        pass
    try:
        frame["tc"] = ir["dcTractionControl"]
    except Exception:
        pass

    # Aero / environment
    try:
        frame["airTemp"] = ir["AirTemp"]
    except Exception:
        pass
    try:
        frame["trackTemp"] = ir["TrackTempCrew"]
    except Exception:
        pass
    try:
        frame["windSpeed"] = ir["WindVel"]
    except Exception:
        pass
    try:
        frame["windDir"] = ir["WindDir"]
    except Exception:
        pass

    # Incidents
    try:
        frame["incidents"] = ir["PlayerCarMyIncidentCount"]
    except Exception:
        pass

    # Lap delta
    try:
        frame["lapDeltaToBest"] = ir["LapDeltaToBestLap"]
    except Exception:
        pass
    try:
        frame["lastLapTime"] = ir["LapLastLapTime"]
    except Exception:
        pass

    return frame

def read_standings(ir):
    """Read standings for all cars on track from iRacing shared memory."""
    standings = []
    try:
        positions = ir["CarIdxPosition"]
        best_laps = ir["CarIdxBestLapTime"]
        last_laps = ir["CarIdxLastLapTime"]
        laps_completed = ir["CarIdxLapCompleted"]
        on_pit = ir["CarIdxOnPitRoad"]
        est_time = ir["CarIdxEstTime"]
        lap_dist = ir["CarIdxLapDistPct"]

        # Get driver info from session string
        driver_info = ir["DriverInfo"]
        drivers = driver_info.get("Drivers", [])

        for idx, d in enumerate(drivers):
            pos = positions[idx] if idx < len(positions) else 0
            if pos <= 0:
                continue

            entry = {
                "pos": pos,
                "carIdx": idx,
                "name": d.get("UserName", "Unknown"),
                "carNum": d.get("CarNumber", ""),
                "car": d.get("CarScreenName", ""),
                "iRating": d.get("IRating", 0),
                "bestLap": best_laps[idx] if idx < len(best_laps) and best_laps[idx] > 0 else None,
                "lastLap": last_laps[idx] if idx < len(last_laps) and last_laps[idx] > 0 else None,
                "lapsCompleted": laps_completed[idx] if idx < len(laps_completed) else 0,
                "onPitRoad": bool(on_pit[idx]) if idx < len(on_pit) else False,
                "estTime": est_time[idx] if idx < len(est_time) else 0,
                "lapDist": lap_dist[idx] if idx < len(lap_dist) else 0,
            }
            standings.append(entry)

        standings.sort(key=lambda x: x["pos"])
    except Exception:
        pass

    return standings

def get_session_info(ir):
    """Extract session info from iRacing session string."""
    try:
        weekend_info = ir["WeekendInfo"]
        return {
            "trackName": weekend_info.get("TrackDisplayName", "Unknown"),
            "trackId": weekend_info.get("TrackID", 0),
            "trackLength": weekend_info.get("TrackLength", "0 km"),
        }
    except Exception:
        return None

def get_driver_info(ir):
    """Extract driver info from iRacing session string."""
    try:
        driver_info = ir["DriverInfo"]
        idx = driver_info.get("DriverCarIdx", 0)
        drivers = driver_info.get("Drivers", [])
        if idx < len(drivers):
            d = drivers[idx]
            return {
                "name": d.get("UserName", "Unknown"),
                "car": d.get("CarScreenName", "Unknown"),
            }
    except Exception:
        pass
    return {"name": "Unknown", "car": "Unknown"}
