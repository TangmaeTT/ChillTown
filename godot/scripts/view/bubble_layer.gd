class_name BubbleLayer
extends CanvasLayer
## Name tags and chat bubbles drawn in 2D at full screen resolution, placed
## over each chibi's head by projecting through the (low-res) game camera.

const HEAD := Vector3(0, 1.72, 0)
const MAX_WIDTH := 280.0
const FONT_SIZE := 20
## Thai stacks marks above and below the line; give wrapped lines room.
const LINE_GAP := 6

var camera: Camera3D
## Screen pixels per game-viewport pixel (the pixel scale).
var screen_scale := 1.0

var _items := {}
var _bubble_style := StyleBoxFlat.new()


func _ready() -> void:
	_bubble_style.bg_color = Color("f4efe2")
	_bubble_style.border_color = Color("2a2430")
	_bubble_style.set_border_width_all(2)
	_bubble_style.set_corner_radius_all(10)
	_bubble_style.content_margin_left = 10
	_bubble_style.content_margin_right = 10
	_bubble_style.content_margin_top = 4
	_bubble_style.content_margin_bottom = 6


func track(c: Chibi) -> void:
	var tag := Label.new()
	tag.add_theme_font_size_override("font_size", 16)
	tag.add_theme_color_override("font_color", Color("d3ca90"))
	tag.add_theme_color_override("font_outline_color", Color(0.05, 0.05, 0.08))
	tag.add_theme_constant_override("outline_size", 5)
	add_child(tag)
	var bubble := PanelContainer.new()
	bubble.add_theme_stylebox_override("panel", _bubble_style)
	var text := Label.new()
	text.add_theme_font_size_override("font_size", FONT_SIZE)
	text.add_theme_color_override("font_color", Color("2a2430"))
	text.add_theme_constant_override("line_spacing", LINE_GAP)
	bubble.add_child(text)
	add_child(bubble)
	_items[c] = {"tag": tag, "bubble": bubble, "text": text, "shown": ""}


func _process(_delta: float) -> void:
	var placed: Array[PanelContainer] = []
	for c: Chibi in _items:
		var it: Dictionary = _items[c]
		var tag: Label = it.tag
		var bubble: PanelContainer = it.bubble
		var head := c.global_position + HEAD
		if camera.is_position_behind(head):
			tag.visible = false
			bubble.visible = false
			continue
		var p := camera.unproject_position(head) * screen_scale
		tag.visible = true
		tag.text = c.display_name
		tag.reset_size()
		tag.position = (p - Vector2(tag.size.x / 2, tag.size.y)).round()

		bubble.visible = c.is_bubble_visible()
		if not bubble.visible:
			continue
		if it.shown != c.bubble_text:
			var text: Label = it.text
			text.text = c.bubble_text
			# Measure the wrapped block from the font (Thai word breaks via
			# ICU), because a wrapping Label doesn't report its own height.
			var font := text.get_theme_font("font")
			var w := font.get_string_size(c.bubble_text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE).x
			if w > MAX_WIDTH:
				text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
				var lines := TextServer.BREAK_MANDATORY | TextServer.BREAK_WORD_BOUND
				var block := font.get_multiline_string_size(c.bubble_text, HORIZONTAL_ALIGNMENT_LEFT,
						MAX_WIDTH, FONT_SIZE, -1, lines)
				var n := ceili(block.y / font.get_height(FONT_SIZE))
				text.custom_minimum_size = Vector2(MAX_WIDTH, block.y + (n - 1) * LINE_GAP)
			else:
				text.autowrap_mode = TextServer.AUTOWRAP_OFF
				text.custom_minimum_size = Vector2.ZERO
			it.shown = c.bubble_text
		bubble.size = bubble.get_combined_minimum_size()
		bubble.position = (p - Vector2(bubble.size.x / 2, tag.size.y + bubble.size.y + 4)).round()
		placed.append(bubble)
	_separate(placed)


## Push overlapping bubbles upward, lowest first, so nearby speakers stay readable.
func _separate(bubbles: Array[PanelContainer]) -> void:
	bubbles.sort_custom(func(a: PanelContainer, b: PanelContainer) -> bool:
		return a.position.y + a.size.y > b.position.y + b.size.y)
	for i in bubbles.size():
		for j in i:
			var r := bubbles[i].get_rect()
			var below := bubbles[j].get_rect()
			if r.intersects(below):
				bubbles[i].position.y = below.position.y - r.size.y - 4
