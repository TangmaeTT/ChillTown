class_name PlayerController
extends CharacterBody3D
## Moves the local player: WASD/arrows relative to the camera, or tap/click on
## the ground to walk there. Height follows the sidewalk, not physics.

const SPEED := 3.2
const BOUNDS := Rect2(-28, -7.6, 56, 15.2)

var chibi: Chibi
var camera: Camera3D
var input_blocked := func() -> bool: return false
## Screen pixels per game-viewport pixel; clicks are converted before raycasting.
var screen_scale := 1.0
var _target = null


func _init(p_chibi: Chibi) -> void:
	chibi = p_chibi


func _ready() -> void:
	motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.3
	cap.height = 1.2
	cs.shape = cap
	cs.position.y = 0.6
	add_child(cs)
	add_child(chibi)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var at: Vector2 = event.position / screen_scale
		var origin := camera.project_ray_origin(at)
		var normal := camera.project_ray_normal(at)
		var hit = Plane(Vector3.UP, 0.0).intersects_ray(origin, normal)
		if hit != null:
			_target = hit


func _physics_process(_delta: float) -> void:
	var dir := Vector3.ZERO
	if not input_blocked.call():
		var v := Input.get_vector("move_left", "move_right", "move_up", "move_down")
		if v != Vector2.ZERO:
			var right := camera.global_basis.x
			var fwd := -camera.global_basis.z
			right.y = 0
			fwd.y = 0
			dir = right.normalized() * v.x + fwd.normalized() * -v.y
			_target = null
	if dir == Vector3.ZERO and _target != null:
		var to: Vector3 = _target - position
		to.y = 0
		if to.length() < 0.12:
			_target = null
		else:
			dir = to.normalized()

	velocity = dir.limit_length(1.0) * SPEED
	move_and_slide()
	position.x = clampf(position.x, BOUNDS.position.x, BOUNDS.end.x)
	position.z = clampf(position.z, BOUNDS.position.y, BOUNDS.end.y)
	position.y = CityBuilder.ground_height(position)
	chibi.set_motion(clampf(get_real_velocity().length() / SPEED, 0.0, 1.0), dir)
