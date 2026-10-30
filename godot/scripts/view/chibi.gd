class_name Chibi
extends Node3D
## Chibi base built in code from the proportions of art-in/char/designbase.png
## (head about half the height, short legs, stubby arms), drawn with the toon
## shader and shown pixelated by the game view. Rigid parts hang off pivot
## nodes (hips, shoulders, head), like Roblox R6, so outfit pieces can attach
## per part later. The face is a decal from tools/face_from_ref.py; blinking
## swaps it for the closed-eyes copy. Faces -Z.

const BUBBLE_SECONDS := 6.0
const OUTLINE := 0.012
## Whole figure scale: 1.45 m drawn proportions x 1.25 so the face reads at pixel size.
const SCALE := 1.25
const HEAD_R := 0.36
const HEAD_Y := 1.1
## Visual layer for the head only, so the face decal doesn't paint hair or hands.
const FACE_LAYER := 1 << 9
const FACE_OPEN := preload("res://assets/textures/face_base_open.png")
const FACE_CLOSED := preload("res://assets/textures/face_base_closed.png")

var look := {
	"skin": Color("eec6a8"), "hair": Color("3d2c26"), "top": Color("bdb4a6"),
	"bottom": Color("3b3a3a"), "shoes": Color("2e2b2a"), "sole": Color("e6dccb"),
	"hair_style": "messy",
}
## Read by BubbleLayer, which draws name tags and bubbles in 2D at full
## resolution so Thai text stays sharp over the pixelated world.
var display_name := ""
## Height of the name tag above the feet, metres.
var tag_height := 2.15
var bubble_text := ""

var _rig := Node3D.new()
var _legs: Array[Node3D] = []
var _arms: Array[Node3D] = []
var _face: Decal
var _phase := 0.0
var _speed01 := 0.0
var _bubble_left := 0.0
var _blink_in := 2.0
var _yaw_target := 0.0


func _init(p_look := {}) -> void:
	look.merge(p_look, true)


func _ready() -> void:
	_rig.scale = Vector3.ONE * SCALE
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
	_face.texture_albedo = FACE_CLOSED if _blink_in < 0.0 else FACE_OPEN
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
	# Fill light so faces read with a lamp behind them at night; by day it
	# drops to a fraction so light colours don't wash out.
	mi.material_override = Toon.mat(color, 0.0, Color.BLACK, 0.0, outline, 0.5, 1.0, false, 0.2, 0.45)
	parent.add_child(mi)
	return mi


func _sphere(r: float) -> SphereMesh:
	var m := SphereMesh.new()
	m.radius = r
	m.height = r * 2.0
	m.radial_segments = 20
	m.rings = 10
	return m


func _capsule(r: float, h: float) -> CapsuleMesh:
	var m := CapsuleMesh.new()
	m.radius = r
	m.height = h
	m.radial_segments = 16
	return m


func _cylinder(r: float, h: float) -> CylinderMesh:
	var m := CylinderMesh.new()
	m.top_radius = r
	m.bottom_radius = r
	m.height = h
	m.radial_segments = 16
	return m


func _build() -> void:
	# Legs: trousers with a rolled cuff, two-tone shoes.
	for side in [-1.0, 1.0]:
		var hip := Node3D.new()
		hip.position = Vector3(side * 0.095, 0.40, 0)
		_rig.add_child(hip)
		_part(hip, _capsule(0.1, 0.32), Vector3(0, -0.14, 0), look.bottom)
		_part(hip, _cylinder(0.108, 0.045), Vector3(0, -0.255, 0), Color(look.bottom).lightened(0.12))
		_part(hip, _sphere(1.0), Vector3(0, -0.325, -0.035), look.shoes, Vector3(0.11, 0.065, 0.155))
		_part(hip, _sphere(1.0), Vector3(0, -0.365, -0.035), look.sole, Vector3(0.105, 0.025, 0.15), 0.0)
		_legs.append(hip)

	# Torso: T-shirt, slightly flattened front to back, a hint of neck.
	_part(_rig, _capsule(0.185, 0.42), Vector3(0, 0.575, 0), look.top, Vector3(1, 1, 0.78))
	_part(_rig, _cylinder(0.07, 0.08), Vector3(0, 0.76, 0), look.skin, Vector3.ONE, 0.0)

	# Arms: short sleeve, bare forearm, round hand.
	for side in [-1.0, 1.0]:
		var shoulder := Node3D.new()
		shoulder.position = Vector3(side * 0.205, 0.70, 0)
		_rig.add_child(shoulder)
		_part(shoulder, _capsule(0.08, 0.2), Vector3(side * 0.02, -0.06, 0), look.top)
		_part(shoulder, _capsule(0.058, 0.17), Vector3(side * 0.025, -0.19, 0), look.skin)
		_part(shoulder, _sphere(0.068), Vector3(side * 0.028, -0.29, 0), look.skin)
		_arms.append(shoulder)

	# Head with ears; the face decal paints only the head (its own visual layer).
	var head := Node3D.new()
	head.position = Vector3(0, HEAD_Y, 0)
	_rig.add_child(head)
	var skull := _part(head, _sphere(HEAD_R), Vector3.ZERO, look.skin, Vector3(1.0, 0.97, 0.95))
	skull.layers = FACE_LAYER | 1
	for side in [-1.0, 1.0]:
		_part(head, _sphere(0.065), Vector3(side * 0.35, -0.05, 0.02), look.skin, Vector3(0.6, 1.0, 0.8))
	_face = Decal.new()
	# Box share of the head width in the reference (170 / 250 px). The reference
	# has the features 0.21 head heights below the middle, but the camera looks
	# down 30 degrees, so they sit higher here or they'd read as a chin.
	var fw := HEAD_R * 2 * 0.68
	_face.size = Vector3(fw, 0.3, fw * FACE_OPEN.get_height() / FACE_OPEN.get_width())
	_face.position = Vector3(0, -0.1 * HEAD_R * 2, -HEAD_R * 0.75)
	_face.rotation.x = -PI / 2           # project along +Z, into the face ...
	_face.rotate(Vector3.BACK, PI)       # ... with the picture the right way up
	_face.texture_albedo = FACE_OPEN
	_face.cull_mask = FACE_LAYER
	_face.upper_fade = 0.0
	_face.lower_fade = 0.0
	head.add_child(_face)

	if look.hair_style == "messy":
		_messy_hair(head)


## Fluffy messy cut after desginman2.png: a cap set back from the face, a row
## of bangs over the forehead, side tufts, bumps over the crown and an ahoge.
func _messy_hair(head: Node3D) -> void:
	var c: Color = look.hair
	# Main mass: a smooth cap, set back so the face stays clear.
	_part(head, _sphere(HEAD_R * 1.08), Vector3(0, 0.06, 0.06), c, Vector3(1.05, 0.92, 1.0))
	# Bangs: pointed locks over the forehead, tips stopping just above the eyes.
	for i in 6:
		var x := (i - 2.5) * 0.085
		_lock(head, Vector3(x, 0.17 - absf(x) * 0.2, -0.3 + absf(x) * 0.18), 0.07, 0.16, -x * 1.6, 0.3)
	# Side locks over the ears and a fringe of points around the nape.
	for side in [-1.0, 1.0]:
		_lock(head, Vector3(side * 0.33, 0.0, -0.08), 0.07, 0.26, side * 0.15, 0.1)
		_lock(head, Vector3(side * 0.3, 0.02, 0.12), 0.07, 0.24, side * 0.35, -0.2)
	for i in 5:
		var x := (i - 2) * 0.12
		_lock(head, Vector3(x, -0.02, 0.3 - absf(x) * 0.3), 0.075, 0.22, x * 0.8, -0.45)
	# A few stray points over the crown break up the silhouette.
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	for i in 7:
		var d := Vector3(rng.randf_range(-0.8, 0.8), rng.randf_range(0.5, 1), rng.randf_range(-0.3, 0.9)).normalized()
		var lock := _lock(head, d * HEAD_R * 1.0 + Vector3(0, 0.06, 0.06), 0.06, 0.18, 0.0, 0.0)
		lock.look_at(lock.global_position + d, Vector3.FORWARD)
		lock.rotate_object_local(Vector3.RIGHT, -PI / 2)
	var tuft := _part(head, _capsule(0.028, 0.18), Vector3(0.02, HEAD_R + 0.08, 0.03), c)
	tuft.rotation.z = -0.4
	var tip := _part(head, _capsule(0.024, 0.12), Vector3(-0.04, HEAD_R + 0.16, 0.03), c)
	tip.rotation.z = 0.9


## A cone of hair, wide at the root and pointed at the tip, hanging down from
## `root` and tilted by `roll` (sideways) and `pitch` (forward +, back -).
func _lock(head: Node3D, root: Vector3, width: float, length: float, roll: float, pitch: float) -> MeshInstance3D:
	var cone := CylinderMesh.new()
	cone.top_radius = width
	cone.bottom_radius = 0.0
	cone.height = length
	cone.radial_segments = 8
	var pivot := Node3D.new()
	pivot.position = root
	pivot.rotation = Vector3(pitch, 0, roll)
	head.add_child(pivot)
	var mi := _part(pivot, cone, Vector3(0, -length / 2, 0), look.hair, Vector3(1, 1, 0.7))
	return mi
