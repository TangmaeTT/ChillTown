class_name SpriteChibi
extends Chibi
## Character drawn as 2D pixel art (Flavour Edge style) standing in the 3D
## world: a card turned to face the camera square-on, so its pixels aren't
## squashed, lit by the world's lights and casting a silhouette shadow.
## The sheet is the 8-direction walk from tools/walk_sheet.py: 9 columns
## (0 = standing, 1-8 = walk) x 8 rows in screen directions E SE S SW W NW N NE,
## 96 px cells with the feet at y = 90. Same API as Chibi, so it drops in.

var CELL := 96
var FEET := 90
const WALK_FRAMES := 8
const WALK_FPS := 10.0
## One sprite pixel = one game pixel at the default zoom (9 m of view over 360 px).
var PIXEL := 0.025
## The camera looks down 30 degrees from the -X -Z side.
const CARD_ROT := Vector3(-PI / 6, -3.0 * PI / 4.0, 0)

## Codex-drawn base (31 Oct): 5 drawn directions + 3 mirrored, stand + 8-frame walk, ~70 px.
var sheet: Texture2D = preload("res://assets/characters/walk_v62.png")
var _card := MeshInstance3D.new()
var _pivot := Node3D.new()
var _mat: ShaderMaterial
var _row := 2
var _walk_t := 0.0


## Dev: `-- --small` uses the half-size 16-colour outlined test sheet at the
## coarser pixel size 3 (Flavour Edge-like density).
func _init(p_look := {}) -> void:
	super(p_look)
	if OS.get_cmdline_user_args().has("--small"):
		sheet = load("res://assets/characters/walk_small.png")
		CELL = 48
		FEET = 45
		PIXEL = 0.0375


func _ready() -> void:
	tag_height = 2.4
	_rig.free()                          # Chibi's 3D rig isn't used here
	# Uses the world's toon shader (soft light, night fill like other
	# characters, alpha cut so the shadow is the silhouette).
	_mat = Toon.mat(Color.WHITE, 0.0, Color.BLACK, 0.0, 0.0, 0.0, 0.0, false, 0.2, 0.45).duplicate()
	_mat.set_shader_parameter("use_tex", true)
	_mat.set_shader_parameter("albedo_tex", sheet)
	_mat.set_shader_parameter("light_as_up", true)
	var q := QuadMesh.new()
	q.size = Vector2.ONE * CELL * PIXEL
	_card.mesh = q
	_card.material_override = _mat
	_card.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_DOUBLE_SIDED
	# Feet line (y = 90 of 96) on the pivot, which sits on the node's origin.
	_card.position.y = (CELL / 2.0 - (CELL - FEET)) * PIXEL
	_pivot.add_child(_card)
	add_child(_pivot)
	_show(0)


## The card never turns with the walking direction; the sheet row does.
func set_motion(speed01: float, dir: Vector3) -> void:
	_speed01 = speed01
	if dir.length_squared() > 0.0001:
		# World direction -> screen: +X goes up-left, +Z up-right.
		var right := (dir.z - dir.x)
		var down := -(dir.x + dir.z)
		_row = posmod(roundi(atan2(down, right) / (PI / 4)), 8)


func _show(col: int) -> void:
	var cols := 1.0 + WALK_FRAMES
	_mat.set_shader_parameter("uv_rect", Vector4(col / cols, _row / 8.0, 1.0 / cols, 1.0 / 8.0))


func _process(delta: float) -> void:
	_pivot.global_rotation = CARD_ROT
	if _speed01 > 0.05:
		_walk_t += delta * WALK_FPS * lerpf(0.6, 1.0, _speed01)
		_show(1 + int(_walk_t) % WALK_FRAMES)
	else:
		_walk_t = 0.0
		_show(0)
	if _bubble_left > 0.0:
		_bubble_left -= delta
