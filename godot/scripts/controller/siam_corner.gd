extends Node3D
## Test scene: one Siam street corner at night. Wires the chat model to the
## chat panel and chibis, sets up lights, rain, camera and day/night toggle.
## User args (after "--"): --say=<text>  --day  --no-rain  --zoom=<f>  (plus DevShot's).

const CAM_OFFSET := Vector3(0, 8, -12)
const ZOOM_RANGE := Vector2(0.45, 1.6)
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
var chat := ChatPanel.new()
var env := Environment.new()
var sun := DirectionalLight3D.new()
var rain: GPUParticles3D
var night := true
var _npc_line := 0
var _npc_timer := 0.4
var zoom := 1.0


func _ready() -> void:
	_setup_input()
	_setup_world()
	CityBuilder.build(self)

	player = PlayerController.new(Chibi.new())
	player.position = Vector3(-1.5, 0, -5.4)
	add_child(player)
	player.chibi.set_display_name("torad")
	player.camera = camera
	player.input_blocked = chat.is_typing

	npc = Chibi.new({"hair": Color("6b4a3a"), "top": Color("8ab074"), "bottom": Color("51444a")})
	npc.position = Vector3(0.6, CityBuilder.SIDEWALK_TOP, -5.0)
	npc.rotation.y = PI * 0.75
	add_child(npc)
	npc.set_display_name("มิว")
	npc.set_motion(0.0, Vector3(-1, 0, -0.6))

	camera.fov = 32
	camera.position = player.position + CAM_OFFSET * zoom
	var attrs := CameraAttributesPractical.new()
	attrs.dof_blur_far_enabled = true
	attrs.dof_blur_far_distance = 20.0
	attrs.dof_blur_far_transition = 10.0
	attrs.dof_blur_near_enabled = true
	attrs.dof_blur_near_distance = 7.0
	attrs.dof_blur_near_transition = 4.0
	attrs.dof_blur_amount = 0.06
	camera.attributes = attrs
	add_child(camera)
	camera.look_at(player.position + Vector3.UP)

	add_child(chat)
	chat.submitted.connect(func(t: String) -> void: chat_log.post("torad", t))
	chat_log.message_added.connect(_on_message)

	rain = _make_rain()
	add_child(rain)

	for a in OS.get_cmdline_user_args():
		if a.begins_with("--say="):
			chat_log.post("torad", a.substr(6))
		elif a == "--day":
			_set_night(false)
		elif a == "--no-rain":
			rain.emitting = false
		elif a.begins_with("--zoom="):
			zoom = float(a.substr(7))
			camera.position = player.position + CAM_OFFSET * zoom
			camera.look_at(player.position + Vector3.UP)


func _process(delta: float) -> void:
	var focus := player.position + Vector3.UP
	camera.position = camera.position.lerp(focus + CAM_OFFSET * zoom, minf(1.0, delta * 5.0))
	camera.look_at(focus)
	rain.position = player.position + Vector3(0, 12, 2)

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
			_set_night(not night)


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


func _setup_world() -> void:
	env.background_mode = Environment.BG_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.glow_enabled = true
	env.glow_intensity = 0.9
	env.glow_bloom = 0.05
	env.glow_hdr_threshold = 0.9
	env.fog_enabled = true
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	sun.shadow_enabled = true
	sun.rotation_degrees = Vector3(-50, 150, 0)
	add_child(sun)
	_set_night(true)


func _set_night(on: bool) -> void:
	night = on
	if on:
		env.background_color = Color("0d1622")
		env.ambient_light_color = Color("3b4f73")
		env.ambient_light_energy = 0.55
		env.fog_light_color = Color("1b2a3c")
		env.fog_density = 0.012
		sun.light_color = Color("8fa6d8")
		sun.light_energy = 0.35
	else:
		env.background_color = Color("9fb8c8")
		env.ambient_light_color = Color("a9b7c9")
		env.ambient_light_energy = 0.6
		env.fog_light_color = Color("b8c6cf")
		env.fog_density = 0.006
		sun.light_color = Color("fff1dc")
		sun.light_energy = 1.3
	for l in get_tree().get_nodes_in_group("night_lights"):
		l.visible = on


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
