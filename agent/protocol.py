import json

def make_message(msg_type, payload):
    return json.dumps({"type": msg_type, "payload": payload})

def hello_message(driver_name, car, track_id, track_name, track_length=0):
    return make_message("agent:hello", {
        "driverName": driver_name,
        "car": car,
        "trackId": track_id,
        "trackName": track_name,
        "trackLength": track_length,
    })

def frame_message(frame):
    return make_message("agent:frame", frame)

def lap_complete_message(lap_number, lap_time, fuel_used, valid):
    return make_message("agent:lapComplete", {
        "lapNumber": lap_number,
        "lapTime": lap_time,
        "fuelUsed": fuel_used,
        "valid": valid,
    })

def session_info_message(track_name, track_length, session_type):
    return make_message("agent:sessionInfo", {
        "trackName": track_name,
        "trackLength": track_length,
        "sessionType": session_type,
    })

def standings_message(standings):
    return make_message("agent:standings", standings)
