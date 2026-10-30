class_name SkyRig
extends Node3D
## Lights the world from the clock: sun/moon direction (shadows sweep through
## the day), sun colour, ambient, background and fog by hour, street lamps on
## at night. Only the lamps nearest the player cast shadows, to stay within
## mobile budgets.

const SHADOW_LAMPS := 2

## hour, sun colour, sun energy, ambient colour, ambient energy, background
const KEYS := [
	[0.0, "7f95d0", 0.25, "2e3c66", 0.5, "0a0f1e"],
	[5.5, "ffb38a", 0.35, "6a6a8a", 0.5, "3a3e5a"],
	[7.0, "fff0d8", 1.1, "a9b7c9", 0.55, "9fb8c8"],
	[12.0, "fff8ec", 1.35, "b0bfcf", 0.6, "a8c4d4"],
	[16.5, "ffe0b0", 1.15, "a9a9c0", 0.55, "9fb0c0"],
	[18.3, "ff9a6a", 0.6, "6a5a7a", 0.5, "4a3a5a"],
	[19.5, "7f95d0", 0.25, "2e3c66", 0.5, "0a0f1e"],
	[24.0, "7f95d0", 0.25, "2e3c66", 0.5, "0a0f1e"],
]

var clock: GameClock
var env := Environment.new()
var sun := DirectionalLight3D.new()
var _shadow_check := 0.0


func _ready() -> void:
	env.background_mode = Environment.BG_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.glow_enabled = true
	env.glow_intensity = 0.8
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 0.9
	env.fog_enabled = true
	env.fog_density = 0.003
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 45.0
	sun.shadow_blur = 0.6
	add_child(sun)


## focus: where the player is, for picking which lamps cast shadows.
func update(delta: float, focus: Vector3) -> void:
	var h := clock.hours
	var i := 0
	while KEYS[i + 1][0] < h:
		i += 1
	var a: Array = KEYS[i]
	var b: Array = KEYS[i + 1]
	var t := inverse_lerp(a[0], b[0], h)
	sun.light_color = Color(a[1]).lerp(Color(b[1]), t)
	sun.light_energy = lerpf(a[2], b[2], t)
	env.ambient_light_color = Color(a[3]).lerp(Color(b[3]), t)
	env.ambient_light_energy = lerpf(a[4], b[4], t)
	env.background_color = Color(a[5]).lerp(Color(b[5]), t)
	env.fog_light_color = env.background_color.darkened(0.15)

	# Sun by day, moon by night: both arc east -> west over 12 hours.
	var arc := fposmod(h - 6.0, 12.0) / 12.0
	var elevation := lerpf(12.0, 62.0, sin(arc * PI))
	sun.rotation_degrees = Vector3(-elevation, lerpf(100.0, -100.0, arc) + 180.0, 0)

	var glow_amount := 0.0
	if h >= 17.5:
		glow_amount = smoothstep(17.5, 19.0, h)
	elif h < 6.5:
		glow_amount = 1.0 - smoothstep(5.5, 6.5, h)
	RenderingServer.global_shader_parameter_set("night_amount", glow_amount)

	var night := clock.is_night()
	var lamps := get_tree().get_nodes_in_group("night_lights")
	for l: Light3D in lamps:
		l.visible = night
	_shadow_check -= delta
	if night and _shadow_check <= 0.0:
		_shadow_check = 0.5
		var street := lamps.filter(func(l: Light3D) -> bool: return l.is_in_group("street_lamps"))
		street.sort_custom(func(p: Light3D, q: Light3D) -> bool:
			return p.global_position.distance_squared_to(focus) < q.global_position.distance_squared_to(focus))
		for n in street.size():
			street[n].shadow_enabled = n < SHADOW_LAMPS
