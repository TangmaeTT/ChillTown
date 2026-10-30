class_name HairPicker
extends CanvasLayer
## Hair style and dye picker, toggled with H. Emits changed(style, tint);
## the controller applies it to the player. tint alpha 0 = drawn colour.

signal changed(style: String, tint: Color)

const DYES := {
	"สีเดิม": Color(0, 0, 0, 0),
	"ดำ": Color("2a2228"),
	"น้ำตาลเข้ม": Color("4a3226"),
	"น้ำตาลแดง": Color("7a3a2a"),
	"บลอนด์": Color("d8b878"),
	"ชมพู": Color("e08aa8"),
	"ฟ้า": Color("7aa8d8"),
	"มิ้นต์": Color("7ac8a8"),
	"ม่วง": Color("8a6ab8"),
	"เทาเงิน": Color("b8b8c0"),
}

var style := ""
var tint := Color(0, 0, 0, 0)
var _panel := PanelContainer.new()
var _style_buttons := {}
var _dye_buttons := {}


func _ready() -> void:
	layer = 3
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.08, 0.12, 0.88)
	sb.set_corner_radius_all(12)
	sb.set_content_margin_all(14)
	_panel.add_theme_stylebox_override("panel", sb)
	_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER_RIGHT, Control.PRESET_MODE_MINSIZE, 16)
	_panel.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	_panel.visible = false
	add_child(_panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	_panel.add_child(col)
	col.add_child(_label("ทรงผม  (H = ปิด)", 22, Color("d3ca90")))
	var styles := HBoxContainer.new()
	col.add_child(styles)
	for id in SpriteChibi.HAIR_STYLES:
		var b := _button(SpriteChibi.HAIR_STYLES[id])
		b.pressed.connect(func() -> void: _pick(id, tint))
		styles.add_child(b)
		_style_buttons[id] = b
	col.add_child(_label("สีผม", 18, Color(0.85, 0.82, 0.7)))
	var grid := GridContainer.new()
	grid.columns = 5
	grid.add_theme_constant_override("h_separation", 6)
	grid.add_theme_constant_override("v_separation", 6)
	col.add_child(grid)
	for name in DYES:
		var c: Color = DYES[name]
		var b := _button(name)
		b.custom_minimum_size = Vector2(72, 40)
		if c.a > 0.0:
			var swatch := StyleBoxFlat.new()
			swatch.bg_color = c
			swatch.set_corner_radius_all(6)
			b.add_theme_stylebox_override("normal", swatch)
			b.add_theme_stylebox_override("hover", swatch)
			b.add_theme_color_override("font_color", Color.WHITE if c.get_luminance() < 0.5 else Color("1a1a1a"))
		b.add_theme_font_size_override("font_size", 14)
		b.pressed.connect(func() -> void: _pick(style, c))
		grid.add_child(b)
		_dye_buttons[name] = b


func _label(text: String, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l


func _button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 18)
	return b


## Show the current look without emitting.
func set_current(p_style: String, p_tint: Color) -> void:
	style = p_style
	tint = p_tint
	_refresh()


func toggle() -> void:
	_panel.visible = not _panel.visible


func is_open() -> bool:
	return _panel.visible


func _pick(p_style: String, p_tint: Color) -> void:
	set_current(p_style, p_tint)
	changed.emit(style, tint)


func _refresh() -> void:
	for id in _style_buttons:
		_style_buttons[id].modulate = Color("ffd98a") if id == style else Color.WHITE
	for name in _dye_buttons:
		var picked: bool = DYES[name].is_equal_approx(tint)
		_dye_buttons[name].text = ("✓ " if picked else "") + name
