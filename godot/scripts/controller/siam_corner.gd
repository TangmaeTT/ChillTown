extends Node3D
## Test scene: one Siam street corner. Wires the chat model to the chat panel
## and chibis, the clock to the sky rig, and sets up rain and the camera.
## The 3D world renders into a low-res SubViewport scaled up with nearest
## filtering (pixel look); UI and chat bubbles stay full resolution.
## User args (after "--"): --say=<text>  --time=<hours>  --dry  --zoom=<f>
## --pixel=<1-4>  --edit (open the layout editor)  (plus DevShot's).

## Isometric 2:1: camera turned 45 degrees and tilted 30 degrees down,
## looking at the shopfronts (+Z) from the street side.
const CAM_DIR := Vector3(-0.6124, 0.5, -0.6124)
const CAM_DISTANCE := 40.0
## Ortho height in metres at zoom 1.
const VIEW_HEIGHT := 12.0
const ZOOM_RANGE := Vector2(0.45, 1.6)
const PIXEL_STEPS := [1, 2, 3, 4]
## Look a little ahead of the player, toward the shopfronts.
const FOCUS_OFFSET := Vector3(1.5, 1, 3.5)
const NPC_LINES := [
	"ฝนตกอีกแล้วเหรอ",
	"ไปกินก๋วยเตี๋ยวกันไหม ร้านนี้น้ำซุปอร่อยนะ",
	"รถไฟฟ้าขบวนสุดท้ายกี่ทุ่มนะ",
	"ญี่ปุ่น ฤๅษี ปั้นจั่น กี่โมงแล้ว",
]

var chat_log := ChatLog.new()
var player: PlayerController
var npc: Chibi
var camera := Camera3D.new()
var view_box := SubViewportContainer.new()
var game_view := SubViewport.new()
var bubbles := BubbleLayer.new()
var chat := ChatPanel.new()
var props := Node3D.new()
var editor := PropEditor.new()
var look := PlayerLook.load_saved()
var hair_picker := HairPicker.new()
var clock := GameClock.new()
var sky := SkyRig.new()
var rain: GPUParticles3D
## 0.75: one texture pixel (32 per metre) is about one game pixel on screen.
var zoom := 0.75
var focus_offset := FOCUS_OFFSET
var pixel := 2
## Ground wetness: soaks up while it rains, dries slowly after. Rain starts off for now
## (R turns it on) until the weather pass.
var wet := 0.0
var _cam_focus := Vector3.ZERO
var _npc_line := 0
var _npc_timer := 0.4


func _ready() -> void:
	_setup_input()
	sky.clock = clock
	add_child(sky)
	CityBuilder.build(self)
	props.name = "Props"
	add_child(props)
	for it in PropLayout.load_or(CityBuilder.default_props).items:
		if PropKit.CATALOG.has(it.kind) and PropKit.available(it.kind):
			PropKit.spawn(props, it.kind, it.pos, it.yaw)

	player = PlayerController.new(SpriteChibi.new({"hair_style": look.hair_style, "hair_tint": look.hair_tint, "outfit": look.outfit}))
	player.position = Vector3(-6.5, 0, 5.4)
	add_child(player)
	player.chibi.display_name = "torad"
	player.camera = camera
	player.input_blocked = chat.is_typing

	npc = SpriteChibi.new({"hair_style": "twintail"})
	npc.position = Vector3(-4.6, CityBuilder.SIDEWALK_TOP, 5.0)
	add_child(npc)
	npc.display_name = "มิว"
	npc.set_motion(0.0, Vector3(-1, 0, -0.6))

	_setup_view()

	add_child(bubbles)
	bubbles.camera = camera
	bubbles.track(player.chibi)
	bubbles.track(npc)
	chat.layer = 2
	add_child(chat)
	chat.submitted.connect(func(t: String) -> void: chat_log.post("torad", t))
	chat_log.message_added.connect(_on_message)
	# Added after the player so it sees clicks first while editing.
	editor.props_root = props
	editor.camera = camera
	add_child(editor)
	add_child(hair_picker)
	hair_picker.set_current(look.hair_style, look.hair_tint)
	hair_picker.changed.connect(_on_hair_changed)
	hair_picker.outfit = look.outfit
	hair_picker.outfit_changed.connect(func(id: String) -> void:
		(player.chibi as SpriteChibi).set_outfit(id)
		look.outfit = id
		look.save())

	rain = _make_rain()
	rain.emitting = false
	add_child(rain)

	for a in OS.get_cmdline_user_args():
		if a.begins_with("--say="):
			chat_log.post("torad", a.substr(6))
		elif a.begins_with("--time="):
			clock.hours = float(a.substr(7))
		elif a == "--dry":
			rain.emitting = false
			wet = 0.0
		elif a.begins_with("--zoom="):
			zoom = float(a.substr(7))
		elif a.begins_with("--pixel="):
			_set_pixel(int(a.substr(8)))
		elif a == "--small":
			_set_pixel(3)
		elif a.begins_with("--outfit="):
			(player.chibi as SpriteChibi).set_outfit(a.substr(9))
		elif a == "--edit":
			editor.toggle()
		elif a.begins_with("--at="):
			# Dev: start the player at x,z (screenshots of one spot).
			var xz := a.substr(5).split(",")
			player.position = Vector3(float(xz[0]), 0, float(xz[1]))
		elif a.begins_with("--look="):
			# Dev: aim the camera at x,z (offset from the player) for screenshots.
			var lz := a.substr(7).split(",")
			focus_offset = Vector3(float(lz[0]), 0, float(lz[1])) - player.position
		elif a == "--charview":
			# Dev: both chibis side by side on open pavement, camera on them.
			player.position = Vector3(-1.0, 0, -6.0)
			npc.position = Vector3(0.3, CityBuilder.SIDEWALK_TOP, -6.6)
			focus_offset = Vector3(0, 1.1, 0)
			zoom = 0.3
			_cam_focus = player.position + focus_offset
			player.chibi.set_motion(0.0, Vector3(-1, 0, -1))
			npc.set_motion(0.0, Vector3(-1, 0, -1))


func _setup_view() -> void:
	# World nodes stay under this root; the SubViewport has no world of its
	# own, so its camera renders the same World3D at low resolution.
	view_box.stretch = true
	view_box.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	view_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	view_box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(view_box)
	view_box.add_child(game_view)
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.near = 0.5
	camera.far = 120.0
	game_view.add_child(camera)
	_add_outline_pass()
	_cam_focus = player.position + focus_offset
	camera.look_at_from_position(_cam_focus + CAM_DIR.normalized() * CAM_DISTANCE, _cam_focus)
	_set_pixel(pixel)


## Full-screen quad on the camera running edge_outline.gdshader.
func _add_outline_pass() -> void:
	var quad := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	quad.mesh = q
	var m := ShaderMaterial.new()
	m.shader = preload("res://assets/shaders/edge_outline.gdshader")
	m.render_priority = -128
	quad.material_override = m
	quad.extra_cull_margin = 16384.0
	quad.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	quad.position = Vector3(0, 0, -1)
	camera.add_child(quad)


func _set_pixel(n: int) -> void:
	pixel = clampi(n, 1, 4)
	view_box.stretch_shrink = pixel
	bubbles.screen_scale = pixel
	editor.screen_scale = pixel
	player.screen_scale = pixel


func _process(delta: float) -> void:
	_cam_focus = _cam_focus.lerp(player.position + focus_offset, minf(1.0, delta * 5.0))
	camera.size = VIEW_HEIGHT * zoom
	# Snap the camera to whole game pixels in its own plane, so the pixelated
	# world doesn't shimmer as it scrolls.
	var texel := camera.size / float(game_view.size.y)
	var b := camera.global_basis
	var local := b.inverse() * (_cam_focus + CAM_DIR.normalized() * CAM_DISTANCE)
	local.x = snappedf(local.x, texel)
	local.y = snappedf(local.y, texel)
	camera.global_position = b * local
	rain.position = player.position + Vector3(0, 12, 2)
	RenderingServer.global_shader_parameter_set("player_position", player.position)
	wet = move_toward(wet, 1.0 if rain.emitting else 0.0, delta * (0.2 if rain.emitting else 0.02))
	RenderingServer.global_shader_parameter_set("wet_amount", wet)
	clock.advance(delta)
	sky.update(delta, player.position)
	chat.set_clock(clock.label())

	_npc_timer -= delta
	if _npc_timer <= 0.0:
		chat_log.post("มิว", NPC_LINES[_npc_line % NPC_LINES.size()])
		_npc_line += 1
		_npc_timer = 9.0


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			zoom = clampf(zoom * 0.9, ZOOM_RANGE.x, ZOOM_RANGE.y)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			zoom = clampf(zoom / 0.9, ZOOM_RANGE.x, ZOOM_RANGE.y)
		return
	if event is InputEventMagnifyGesture:
		zoom = clampf(zoom / event.factor, ZOOM_RANGE.x, ZOOM_RANGE.y)
		return
	if not (event is InputEventKey and event.pressed and not event.echo):
		return
	match event.physical_keycode:
		KEY_ENTER, KEY_KP_ENTER:
			chat.input.grab_focus()
		KEY_R:
			rain.emitting = not rain.emitting
		KEY_T:
			clock.skip(2.0)
		KEY_H:
			hair_picker.toggle()
		KEY_P:
			_set_pixel(pixel % PIXEL_STEPS.size() + 1)


func _on_hair_changed(style: String, tint: Color) -> void:
	(player.chibi as SpriteChibi).set_hair(style, tint)
	look.hair_style = style
	look.hair_tint = tint
	look.save()


func _on_message(sender: String, text: String) -> void:
	chat.add_line(sender, text)
	if sender == "torad":
		player.chibi.say(text)
	else:
		npc.say(text)


func _setup_input() -> void:
	var keys := {
		"move_left": [KEY_A, KEY_LEFT], "move_right": [KEY_D, KEY_RIGHT],
		"move_up": [KEY_W, KEY_UP], "move_down": [KEY_S, KEY_DOWN],
	}
	for action in keys:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for k in keys[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = k
			InputMap.action_add_event(action, ev)


func _make_rain() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = 1800
	p.lifetime = 0.8
	p.local_coords = false
	p.visibility_aabb = AABB(Vector3(-20, -16, -20), Vector3(40, 32, 40))
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(16, 0.5, 12)
	pm.direction = Vector3(0.08, -1, 0)
	pm.spread = 2.0
	pm.initial_velocity_min = 16.0
	pm.initial_velocity_max = 20.0
	pm.gravity = Vector3.ZERO
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.015, 0.45)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(0.75, 0.85, 1.0, 0.2)
	m.billboard_mode = BaseMaterial3D.BILLBOARD_FIXED_Y
	q.material = m
	p.draw_pass_1 = q
	return p
