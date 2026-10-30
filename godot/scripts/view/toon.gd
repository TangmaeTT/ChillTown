class_name Toon
## Shared toon materials, cached so equal settings reuse one material.

const TOON_SHADER := preload("res://assets/shaders/toon.gdshader")
const OUTLINE_SHADER := preload("res://assets/shaders/outline.gdshader")
const FONT := preload("res://assets/fonts/Mali-Medium.ttf")

static var _cache := {}


static func mat(color: Color, wet := 0.0, emission := Color.BLACK, energy := 0.0,
		outline := 0.0, rim := 0.0, toon := 0.0, cutaway := false, day_emission := 0.25) -> ShaderMaterial:
	var key := "%s|%s|%s|%s|%s|%s|%s|%s|%s" % [color.to_html(), wet, emission.to_html(), energy, outline, rim, toon, cutaway, day_emission]
	if _cache.has(key):
		return _cache[key]
	var m := ShaderMaterial.new()
	m.shader = TOON_SHADER
	m.set_shader_parameter("albedo", color)
	m.set_shader_parameter("wetness", wet)
	m.set_shader_parameter("emission_color", emission)
	m.set_shader_parameter("emission_energy", energy)
	m.set_shader_parameter("rim_amount", rim)
	m.set_shader_parameter("toon", toon)
	m.set_shader_parameter("cutaway", cutaway)
	m.set_shader_parameter("day_emission", day_emission)
	if outline > 0.0:
		var o := ShaderMaterial.new()
		o.shader = OUTLINE_SHADER
		o.set_shader_parameter("thickness", outline)
		m.next_pass = o
	_cache[key] = m
	return m


static func glow(color: Color, energy: float, cutaway := false) -> ShaderMaterial:
	return mat(color.darkened(0.3), 0.0, color, energy, 0.0, 0.0, 0.0, cutaway)


## Pixel-art face from tools/texture_from_ai.py: `name` is the path stem under
## res://assets/textures/ (expects <name>_albedo.png and <name>_emission.png).
static func textured(name: String, emission_energy := 2.0) -> ShaderMaterial:
	var key := "tex|%s|%s" % [name, emission_energy]
	if _cache.has(key):
		return _cache[key]
	var m := mat(Color.WHITE).duplicate() as ShaderMaterial
	m.set_shader_parameter("use_tex", true)
	m.set_shader_parameter("albedo_tex", load("res://assets/textures/%s_albedo.png" % name))
	m.set_shader_parameter("emission_tex", load("res://assets/textures/%s_emission.png" % name))
	m.set_shader_parameter("tex_emission_energy", emission_energy)
	_cache[key] = m
	return m


## Size in metres of a face texture at the project's 32 px per metre.
static func texture_size_m(name: String) -> Vector2:
	var t: Texture2D = load("res://assets/textures/%s_albedo.png" % name)
	return Vector2(t.get_width(), t.get_height()) / 32.0


## Material for things that may hide the player (fades out around them).
static func occluder(color: Color, outline := 0.0) -> ShaderMaterial:
	return mat(color, 0.0, Color.BLACK, 0.0, outline, 0.0, 0.0, true)


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
