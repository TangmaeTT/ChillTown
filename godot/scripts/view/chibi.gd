class_name Chibi
extends Node3D
## Placeholder chibi built from primitives, standing in for the real 3D base
## model. It already has the parts the outfit system will need (hair, top,
## bottom, shoes as separate meshes), a code walk cycle and blinking. Faces -Z.

const BUBBLE_SECONDS := 6.0
const OUTLINE := 0.012

var look := {
	"skin": Color("f3d2bd"), "hair": Color("3a2a2a"), "top": Color("c26b5a"),
	"bottom": Color("3e4a5e"), "shoes": Color("2a2a30"),
}

var _rig := Node3D.new()
var _legs: Array[Node3D] = []
var _arms: Array[Node3D] = []
var _eyes: Array[Node3D] = []
## Read by BubbleLayer, which draws name tags and bubbles in 2D at full
## resolution so Thai text stays sharp over the pixelated world.
var display_name := ""
var bubble_text := ""
var _phase := 0.0
var _speed01 := 0.0
var _bubble_left := 0.0
var _blink_in := 2.0
var _yaw_target := 0.0


func _init(p_look := {}) -> void:
	look.merge(p_look, true)


func _ready() -> void:
	add_child(_rig)
	_build()


func say(text: String) -> void:
	bubble_text = text
	_bubble_left = BUBBLE_SECONDS


func is_bubble_visible() -> bool:
	return _bubble_left > 0.0


## speed01: 0 idle .. 1 full walk. dir: world direction (y ignored).
func set_motion(speed01: float, dir: Vector3) -> void:
	_speed01 = speed01
	if dir.length_squared() > 0.0001:
		_yaw_target = atan2(-dir.x, -dir.z)


func _process(delta: float) -> void:
	rotation.y = lerp_angle(rotation.y, _yaw_target, minf(1.0, delta * 12.0))
	_phase += delta * lerpf(1.5, 11.0, _speed01)
	var swing := sin(_phase) * 0.7 * _speed01
	_legs[0].rotation.x = swing
	_legs[1].rotation.x = -swing
	_arms[0].rotation.x = -swing * 0.8
	_arms[1].rotation.x = swing * 0.8
	_rig.position.y = absf(sin(_phase)) * 0.05 * _speed01 + sin(_phase * 0.5) * 0.008 * (1.0 - _speed01)

	_blink_in -= delta
	var closed := _blink_in < 0.0
	for e in _eyes:
		e.scale.y = 0.15 if closed else 1.0
	if _blink_in < -0.12:
		_blink_in = randf_range(2.0, 5.0)

	if _bubble_left > 0.0:
		_bubble_left -= delta


func _part(parent: Node3D, mesh: Mesh, pos: Vector3, color: Color, squash := Vector3.ONE,
		outline := OUTLINE) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.scale = squash
	# A little self-light (fill) so faces read even with the lamp behind them.
	mi.material_override = Toon.mat(color, 0.0, color, 0.22, outline, 0.5, 1.0)
	parent.add_child(mi)
	return mi


func _sphere(r: float) -> SphereMesh:
	var m := SphereMesh.new()
	m.radius = r
	m.height = r * 2.0
	return m


func _capsule(r: float, h: float) -> CapsuleMesh:
	var m := CapsuleMesh.new()
	m.radius = r
	m.height = h
	return m


func _build() -> void:
	for side in [-1.0, 1.0]:
		var hip := Node3D.new()
		hip.position = Vector3(side * 0.1, 0.36, 0)
		_rig.add_child(hip)
		_part(hip, _capsule(0.09, 0.34), Vector3(0, -0.16, 0), look.bottom)
		_part(hip, _capsule(0.1, 0.2), Vector3(0, -0.31, -0.03), look.shoes, Vector3(1, 0.6, 1.4))
		_legs.append(hip)

	_part(_rig, _capsule(0.22, 0.52), Vector3(0, 0.6, 0), look.top, Vector3(1, 1, 0.85))

	for side in [-1.0, 1.0]:
		var shoulder := Node3D.new()
		shoulder.position = Vector3(side * 0.25, 0.76, 0)
		_rig.add_child(shoulder)
		_part(shoulder, _capsule(0.07, 0.3), Vector3(side * 0.02, -0.13, 0), look.top)
		_part(shoulder, _sphere(0.06), Vector3(side * 0.02, -0.29, 0), look.skin)
		_arms.append(shoulder)

	var head := Node3D.new()
	head.position = Vector3(0, 1.14, 0)
	_rig.add_child(head)
	_part(head, _sphere(0.36), Vector3.ZERO, look.skin)
	_part(head, _sphere(0.385), Vector3(0, 0.07, 0.06), look.hair, Vector3(1.05, 0.92, 1.0))
	_part(head, _sphere(0.3), Vector3(0, 0.2, -0.2), look.hair, Vector3(0.95, 0.38, 0.6))
	for side in [-1.0, 1.0]:
		var eye := _part(head, _sphere(0.055), Vector3(side * 0.13, -0.05, -0.335),
				Color("1e1a22"), Vector3(0.8, 1.25, 0.4), 0.0)
		_part(eye, _sphere(0.018), Vector3(0.02, 0.025, -0.03), Color.WHITE, Vector3.ONE, 0.0)
		_eyes.append(eye)
		_part(head, _sphere(0.05), Vector3(side * 0.21, -0.14, -0.3), Color("e89a9a"),
				Vector3(1, 0.6, 0.3), 0.0)
	_part(head, BoxMesh.new(), Vector3(0, -0.18, -0.352), Color("4a2a2a"), Vector3(0.06, 0.016, 0.01), 0.0)
