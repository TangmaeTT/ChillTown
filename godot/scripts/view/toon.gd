class_name Toon
## Shared toon materials, cached so equal settings reuse one material.

const TOON_SHADER := preload("res://assets/shaders/toon.gdshader")
const OUTLINE_SHADER := preload("res://assets/shaders/outline.gdshader")
const FONT := preload("res://assets/fonts/Mali-Medium.ttf")

static var _cache := {}


static func mat(color: Color, wet := 0.0, emission := Color.BLACK, energy := 0.0,
		outline := 0.0, rim := 0.0) -> ShaderMaterial:
	var key := "%s|%s|%s|%s|%s|%s" % [color.to_html(), wet, emission.to_html(), energy, outline, rim]
	if _cache.has(key):
		return _cache[key]
	var m := ShaderMaterial.new()
	m.shader = TOON_SHADER
	m.set_shader_parameter("albedo", color)
	m.set_shader_parameter("wetness", wet)
	m.set_shader_parameter("emission_color", emission)
	m.set_shader_parameter("emission_energy", energy)
	m.set_shader_parameter("rim_amount", rim)
	if outline > 0.0:
		var o := ShaderMaterial.new()
		o.shader = OUTLINE_SHADER
		o.set_shader_parameter("thickness", outline)
		m.next_pass = o
	_cache[key] = m
	return m


static func glow(color: Color, energy: float) -> ShaderMaterial:
	return mat(color.darkened(0.3), 0.0, color, energy)


static func label(text: String, size: int, color := Color.WHITE, outline := 10) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font = FONT
	l.font_size = size
	l.pixel_size = 0.004
	l.modulate = color
	l.outline_size = outline
	l.outline_modulate = Color(0.05, 0.05, 0.08)
	return l
