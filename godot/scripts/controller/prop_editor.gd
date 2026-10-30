class_name PropEditor
extends CanvasLayer
## In-game layout editor, toggled with Tab. Click a prop to select it and drag
## to move it at its own height (5 cm snap). Q/E turn it 90 degrees, R/F raise
## or lower it (Shift: 25 cm), G drops it to the ground, C copies, Delete or X
## removes, Esc deselects, Ctrl+S or the button saves to PropLayout. The palette adds a new prop in
## the middle of the screen. WASD still walks, which moves the camera.

const SNAP := 0.05
const PICK_RADIUS := 48.0

var props_root: Node3D
var camera: Camera3D
## Screen pixels per game-viewport pixel (the pixel scale).
var screen_scale := 1.0
var active := false
var selected: Node3D

var _panel := PanelContainer.new()
var _info := Label.new()
var _highlight := MeshInstance3D.new()
var _dragging := false
var _grab := Vector3.ZERO


func _ready() -> void:
	layer = 3
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.06, 0.08, 0.12, 0.85)
	style.set_corner_radius_all(12)
	style.set_content_margin_all(12)
	_panel.add_theme_stylebox_override("panel", style)
	# A slim bar above the chat input, so it covers as little of the street as possible.
	_panel.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE, Control.PRESET_MODE_MINSIZE, 16)
	_panel.offset_bottom = -92
	_panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_panel.visible = false
	add_child(_panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	_panel.add_child(col)
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 12)
	col.add_child(top)
	top.add_child(_label("โหมดจัดวาง", 20, Color("d3ca90")))
	_info.add_theme_font_size_override("font_size", 16)
	_info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(_info)
	var save := Button.new()
	save.text = "  บันทึก  "
	save.add_theme_font_size_override("font_size", 18)
	save.pressed.connect(_save)
	top.add_child(save)
	var close := Button.new()
	close.text = "  ออก  "
	close.add_theme_font_size_override("font_size", 18)
	close.pressed.connect(toggle)
	top.add_child(close)
	var row := HFlowContainer.new()
	row.add_theme_constant_override("h_separation", 6)
	col.add_child(row)
	for kind in PropKit.CATALOG:
		var b := Button.new()
		b.text = PropKit.CATALOG[kind][2]
		b.add_theme_font_size_override("font_size", 16)
		b.pressed.connect(_add.bind(kind))
		row.add_child(b)
	# Buttons must not take keyboard focus, or Tab would cycle through them.
	for b in _panel.find_children("*", "Button", true, false):
		b.focus_mode = Control.FOCUS_NONE
	col.add_child(_label("คลิก = เลือก/ลาก · Q/E = หมุน · R/F = ยกขึ้น/ลง (Shift ทีละ 25 ซม.) · G = วางลงพื้น · C = ก๊อป · Delete = ลบ · Esc = ยกเลิก · Ctrl+S = บันทึก · Tab = ออก", 14, Color(0.85, 0.82, 0.7)))

	var box := BoxMesh.new()
	box.size = Vector3.ONE
	_highlight.mesh = box
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(1.0, 0.85, 0.3, 0.25)
	m.no_depth_test = true
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_highlight.material_override = m
	_highlight.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_highlight.visible = false
	props_root.get_parent().add_child.call_deferred(_highlight)
	_refresh()


func _label(text: String, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l


func toggle() -> void:
	active = not active
	_panel.visible = active
	if not active:
		_select(null)


## Tab is caught here, before the GUI, which would otherwise use it to move focus.
func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_TAB:
		var focus := get_viewport().gui_get_focus_owner()
		if focus is LineEdit:
			return
		toggle()
		get_viewport().set_input_as_handled()


func _unhandled_input(event: InputEvent) -> void:
	if not active:
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			var hit := _pick(event.position)
			_select(hit)
			_dragging = hit != null
			if hit:
				var p = _ground_at(event.position, hit.position.y)
				_grab = (p - hit.position) if p != null else Vector3.ZERO
		else:
			_dragging = false
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and _dragging and selected:
		var p = _ground_at(event.position, selected.position.y)
		if p != null:
			var to: Vector3 = p - _grab
			selected.position.x = snappedf(to.x, SNAP)
			selected.position.z = snappedf(to.z, SNAP)
			_refresh()
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed:
		var step := 0.25 if event.shift_pressed else SNAP
		var used := true
		match event.physical_keycode:
			KEY_Q:
				_turn(PI / 2)
			KEY_E:
				_turn(-PI / 2)
			KEY_R:
				_lift(step)
			KEY_F:
				_lift(-step)
			KEY_G:
				if selected:
					selected.position.y = CityBuilder.SIDEWALK_TOP
					_refresh()
			KEY_C:
				_copy()
			KEY_DELETE, KEY_X:
				_delete()
			KEY_ESCAPE:
				_select(null)
			KEY_S:
				used = event.ctrl_pressed
				if used:
					_save()
			_:
				used = false
		if used:
			get_viewport().set_input_as_handled()


## Prop whose middle is nearest the mouse on screen, within PICK_RADIUS.
func _pick(mouse: Vector2) -> Node3D:
	var best: Node3D = null
	var best_d := PICK_RADIUS
	for n: Node3D in props_root.get_children():
		if n.is_queued_for_deletion():
			continue
		var size: Vector3 = n.get_meta("size")
		var c := n.global_position + Vector3(0, size.y / 2, 0)
		if camera.is_position_behind(c):
			continue
		var d := (camera.unproject_position(c) * screen_scale).distance_to(mouse)
		if d < best_d:
			best_d = d
			best = n
	return best


func _ground_at(mouse: Vector2, y: float) -> Variant:
	var at := mouse / screen_scale
	return Plane(Vector3.UP, y).intersects_ray(camera.project_ray_origin(at), camera.project_ray_normal(at))


func _select(n: Node3D) -> void:
	selected = n
	_refresh()


func _refresh() -> void:
	if selected == null:
		_highlight.visible = false
		_info.text = "คลิกที่ของเพื่อเลือก หรือกดปุ่มด้านบนเพื่อเพิ่ม"
		return
	var size: Vector3 = selected.get_meta("size")
	_highlight.visible = true
	_highlight.global_position = selected.global_position + Vector3(0, size.y / 2, 0)
	_highlight.rotation.y = selected.rotation.y
	_highlight.scale = size + Vector3.ONE * 0.06
	var kind: String = selected.get_meta("kind")
	var p := selected.position
	_info.text = "%s  ·  x %.2f  สูง %.2f  z %.2f  ·  หมุน %d°" % [
		PropKit.CATALOG[kind][2], p.x, p.y, p.z, roundi(rad_to_deg(selected.rotation.y))]


func _turn(a: float) -> void:
	if selected == null or PropKit.CATALOG[selected.get_meta("kind")][0] == "card":
		return
	PropKit.set_yaw(selected, wrapf(selected.rotation.y + a, -PI, PI))
	_refresh()


func _lift(d: float) -> void:
	if selected == null:
		return
	selected.position.y = maxf(0.0, snappedf(selected.position.y + d, SNAP))
	_refresh()


func _copy() -> void:
	if selected == null:
		return
	_select(PropKit.spawn(props_root, selected.get_meta("kind"), selected.position + Vector3(0.3, 0, -0.3), selected.rotation.y))


func _delete() -> void:
	if selected == null:
		return
	selected.queue_free()
	_select(null)


func _add(kind: String) -> void:
	var mid := camera.get_viewport().get_visible_rect().size / 2
	var hit = Plane(Vector3.UP, CityBuilder.SIDEWALK_TOP).intersects_ray(
			camera.project_ray_origin(mid), camera.project_ray_normal(mid))
	if hit == null:
		return
	var p: Vector3 = hit
	_select(PropKit.spawn(props_root, kind, Vector3(snappedf(p.x, SNAP), p.y, snappedf(p.z, SNAP))))


func _save() -> void:
	var layout := PropLayout.new()
	for n: Node3D in props_root.get_children():
		if not n.is_queued_for_deletion():
			layout.items.append({"kind": n.get_meta("kind"), "pos": n.position, "yaw": n.rotation.y})
	var path := layout.save()
	_info.text = ("บันทึกแล้ว %d ชิ้น → %s" % [layout.items.size(), path]) if path != "" else "บันทึกไม่สำเร็จ"
