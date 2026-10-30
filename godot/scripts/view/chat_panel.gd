class_name ChatPanel
extends CanvasLayer
## Chat input bar, recent-message log and control hints. Emits submitted();
## never touches the ChatLog model itself.

signal submitted(text: String)

const LOG_LINES := 6

var input := LineEdit.new()
var _log := VBoxContainer.new()


func _ready() -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.06, 0.08, 0.12, 0.78)
	style.set_corner_radius_all(12)
	style.set_content_margin_all(10)

	var bar := PanelContainer.new()
	bar.add_theme_stylebox_override("panel", style)
	bar.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE, Control.PRESET_MODE_MINSIZE, 16)
	bar.offset_top = -78
	add_child(bar)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	bar.add_child(row)
	input.placeholder_text = "พิมพ์ข้อความ… (Enter)"
	input.max_length = ChatLog.MAX_LENGTH
	input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	input.add_theme_font_size_override("font_size", 24)
	input.text_submitted.connect(_submit)
	row.add_child(input)
	var send := Button.new()
	send.text = "  ส่ง  "
	send.add_theme_font_size_override("font_size", 24)
	send.pressed.connect(func() -> void: _submit(input.text))
	row.add_child(send)

	var log_panel := PanelContainer.new()
	log_panel.add_theme_stylebox_override("panel", style)
	log_panel.position = Vector2(16, 16)
	log_panel.custom_minimum_size = Vector2(460, 0)
	log_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(log_panel)
	log_panel.add_child(_log)

	var hint := Label.new()
	hint.text = "WASD / แตะพื้น = เดิน · Enter = พิมพ์ · R = ฝน · T = กลางวัน/คืน · P = ขนาดพิกเซล"
	hint.add_theme_font_size_override("font_size", 18)
	hint.add_theme_color_override("font_color", Color(0.85, 0.82, 0.7, 0.8))
	hint.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT, Control.PRESET_MODE_MINSIZE, 16)
	hint.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	add_child(hint)


func add_line(sender: String, text: String) -> void:
	var l := Label.new()
	l.text = "%s: %s" % [sender, text]
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size.x = 440
	l.add_theme_font_size_override("font_size", 20)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_log.add_child(l)
	while _log.get_child_count() > LOG_LINES:
		var old := _log.get_child(0)
		_log.remove_child(old)
		old.queue_free()


func is_typing() -> bool:
	return input.has_focus()


func _submit(text: String) -> void:
	submitted.emit(text)
	input.clear()
	if DisplayServer.is_touchscreen_available():
		input.release_focus()
