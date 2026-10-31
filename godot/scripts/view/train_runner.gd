extends Node3D
## Runs a skytrain into the terminus along Z: comes in from the far end, stops at the
## station, then runs back out the way it came, waits off-screen and starts again.
## `direction` +1: arrives travelling toward +Z.

var direction := 1.0
var delay := 0.0

const FAR := 140.0
const DWELL := 14.0
const WAIT := 12.0
const BRAKE := 2.0              ## m/s^2

var _t := 0.0
var _state := "wait"


func _ready() -> void:
	_t = -delay
	visible = false


func _process(dt: float) -> void:
	_t += dt
	var stop := SiamCity.STATION_Z
	match _state:
		"wait":
			if _t >= WAIT:
				_state = "in"
				position.z = stop - FAR * direction
				visible = true
		"in":
			var left := stop - position.z
			# Brake into the station (v^2 = 2 a s).
			var v := minf(SiamCity.TRAIN_SPEED, sqrt(absf(left) * 2.0 * BRAKE) + 0.3)
			position.z += signf(left) * minf(v * dt, absf(left))
			if absf(left) < 0.01:
				_state = "dwell"
				_t = 0.0
		"dwell":
			if _t >= DWELL:
				_state = "out"
				_t = 0.0
		"out":
			position.z -= direction * minf(SiamCity.TRAIN_SPEED, 1.0 + _t * BRAKE) * dt
			if absf(position.z - stop) > FAR:
				_state = "wait"
				visible = false
				_t = 0.0
