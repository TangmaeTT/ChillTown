extends Node3D
## One lane of the main road: its cars (children, set up by SiamCity.traffic) drive along X
## and wrap round off-screen. Each car keeps a gap to the one ahead and stops for the
## player standing in the lane in front of it.

var direction := -1.0
var speed := 7.0
## Lane span: cars leaving one end come back in at the other.
const SPAN := 140.0
const GAP := 2.5
const ACCEL := 4.0

var _player: Node3D


func _ready() -> void:
	_player = get_tree().current_scene.get("player")


func _process(dt: float) -> void:
	var cars := get_children()
	# Front car first (furthest along the driving direction).
	cars.sort_custom(func(a: Node3D, b: Node3D) -> bool: return a.position.x * direction > b.position.x * direction)
	var lead_back := INF
	for i in cars.size():
		var car: Node3D = cars[i]
		var half: float = car.get_meta("half")
		var front := car.position.x * direction + half
		var room := (lead_back - GAP - front) if i > 0 else INF
		if _player != null and absf(_player.position.z - position.z) < 1.3:
			var ahead := _player.position.x * direction - front
			if ahead > 0.0:                  # in front of the bumper, not alongside
				room = minf(room, ahead - 1.2)
		var v: float = car.get_meta("v", speed)
		# Brake to stop within the room left (v^2 = 2as), otherwise ease back up to speed.
		var safe := sqrt(maxf(room, 0.0) * 2.0 * ACCEL)
		v = minf(minf(speed, v + ACCEL * dt), safe)
		car.set_meta("v", v)
		car.position.x += direction * v * dt
		if car.position.x * direction > SPAN / 2:
			car.position.x -= direction * SPAN
		lead_back = car.position.x * direction - half
