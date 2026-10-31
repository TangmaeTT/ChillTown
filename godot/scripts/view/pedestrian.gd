extends Node3D
## A passer-by: a sprite chibi strolling along X between x0 and x1 at a fixed z (or along
## Z when `along_z`), stopping now and then to look around, turning at the ends.
## Set up by SiamCity.pedestrians.

var x0 := -10.0
var x1 := 10.0
var along_z := false
var speed := 1.1
var look := {}

var _chibi: SpriteChibi
var _dir := 1.0
var _pause := 0.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()
	_chibi = SpriteChibi.new(look)
	add_child(_chibi)
	_dir = 1.0 if _rng.randf() < 0.5 else -1.0


func _process(dt: float) -> void:
	var axis := Vector3(0, 0, 1) if along_z else Vector3(1, 0, 0)
	if _pause > 0.0:
		_pause -= dt
		_chibi.set_motion(0.0, axis * _dir)
		return
	var p := position.z if along_z else position.x
	p += _dir * speed * dt
	if p > x1 or p < x0:
		p = clampf(p, x0, x1)
		_dir = -_dir
	elif _rng.randf() < dt * 0.06:
		_pause = _rng.randf_range(1.5, 5.0)
	if along_z:
		position.z = p
	else:
		position.x = p
	position.y = CityBuilder.ground_height(position)
	_chibi.set_motion(speed / PlayerController.SPEED, axis * _dir)
