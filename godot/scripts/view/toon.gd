class_name Toon
## Shared toon materials, cached so equal settings reuse one material.

const TOON_SHADER := preload("res://assets/shaders/toon.gdshader")
const OUTLINE_SHADER := preload("res://assets/shaders/outline.gdshader")
const FONT := preload("res://assets/fonts/Mali-Medium.ttf")

static var _cache := {}


static func mat(color: Color, wet := 0.0, emission := Color.BLACK, energy := 0.0,
		outline := 0.0, rim := 0.0, toon := 0.0, cutaway := false, day_emission := 0.25,
		fill := 0.0) -> ShaderMaterial:
	var key := "%s|%s|%s|%s|%s|%s|%s|%s|%s|%s" % [color.to_html(), wet, emission.to_html(), energy, outline, rim, toon, cutaway, day_emission, fill]
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
	m.set_shader_parameter("fill", fill)
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
## `cutaway`: dithers out around the player when it sits between camera and player
## (the skytrain overhead).
static func textured(name: String, emission_energy := 2.0, cutaway := false) -> ShaderMaterial:
	var key := "tex|%s|%s|%s" % [name, emission_energy, cutaway]
	if _cache.has(key):
		return _cache[key]
	var m := mat(Color.WHITE).duplicate() as ShaderMaterial
	m.set_shader_parameter("use_tex", true)
	m.set_shader_parameter("cutaway", cutaway)
	m.set_shader_parameter("albedo_tex", load("res://assets/textures/%s_albedo.png" % name))
	m.set_shader_parameter("emission_tex", load("res://assets/textures/%s_emission.png" % name))
	m.set_shader_parameter("tex_emission_energy", emission_energy)
	_cache[key] = m
	return m


## Ground tiled from above in world space (tools/gen_ground.py textures).
## A "city_" texture (Codex-painted, tools/city_convert.py) is used as the colour itself.
static func ground(name: String, color: Color, wet: float, tile_m := 2.0, swap := false) -> ShaderMaterial:
	var key := "ground|%s|%s|%s|%s|%s" % [name, color.to_html(), wet, tile_m, swap]
	if _cache.has(key):
		return _cache[key]
	var m := mat(color, wet).duplicate() as ShaderMaterial
	m.set_shader_parameter("use_ground", true)
	m.set_shader_parameter("ground_raw", name.begins_with("city_"))
	m.set_shader_parameter("ground_swap", swap)
	m.set_shader_parameter("ground_tex", load("res://assets/textures/%s_albedo.png" % name))
	m.set_shader_parameter("ground_tile_m", tile_m)
	_cache[key] = m
	return m


## Material for voxel props: colour (and night glow) from the mesh's vertex colours.
static func vcolor(emission_energy := 2.0) -> ShaderMaterial:
	var key := "vcolor|%s" % emission_energy
	if _cache.has(key):
		return _cache[key]
	var m := mat(Color.WHITE).duplicate() as ShaderMaterial
	m.set_shader_parameter("use_vcolor", true)
	m.set_shader_parameter("vcolor_emission", emission_energy)
	_cache[key] = m
	return m


## Material for big voxel pieces (tools/voxel_from_views.py textured mode): the shader
## reads each face's colour from the oriented views saved next to the model.
static func voxel_tex(name: String, emission_energy := 2.0) -> ShaderMaterial:
	var key := "vtex|%s|%s" % [name, emission_energy]
	if _cache.has(key):
		return _cache[key]
	var info = JSON.parse_string(FileAccess.get_file_as_string("res://assets/models/%s.vx.json" % name))
	var m := mat(Color.WHITE).duplicate() as ShaderMaterial
	m.set_shader_parameter("use_vtex", true)
	m.set_shader_parameter("vtex_size", Vector3(info.w, info.h, info.d))
	m.set_shader_parameter("vcolor_emission", emission_energy)
	for part in ["front", "side", "top"]:
		m.set_shader_parameter("vtex_" + part, load("res://assets/models/%s_vx_%s_albedo.png" % [name, part]))
		m.set_shader_parameter("vtex_%s_em" % part, load("res://assets/models/%s_vx_%s_emission.png" % [name, part]))
	_cache[key] = m
	return m


## True when a face/ground texture has been converted into the project.
static func has_texture(name: String) -> bool:
	return ResourceLoader.exists("res://assets/textures/%s_albedo.png" % name)


## Size in metres of a face texture at the project's 32 px per metre.
static func texture_size_m(name: String) -> Vector2:
	var t: Texture2D = load("res://assets/textures/%s_albedo.png" % name)
	return Vector2(t.get_width(), t.get_height()) / 32.0


## The shopfront hole in a facade texture (transparent pixels in its lower
## half, away from the edges), in metres from the facade's bottom-left corner.
static func hole_rect_m(name: String) -> Rect2:
	var img: Image = (load("res://assets/textures/%s_albedo.png" % name) as Texture2D).get_image()
	if img.is_compressed():
		img.decompress()
	var w := img.get_width()
	var h := img.get_height()
	var lo := Vector2i(w, h)
	var hi := Vector2i(-1, -1)
	for y in range(h / 2, h):
		for x in range(10, w - 10):
			if img.get_pixel(x, y).a < 0.5:
				lo = Vector2i(mini(lo.x, x), mini(lo.y, y))
				hi = Vector2i(maxi(hi.x, x), maxi(hi.y, y))
	if hi.x < 0:
		return Rect2()
	return Rect2(lo.x / 32.0, (h - 1 - hi.y) / 32.0, (hi.x - lo.x + 1) / 32.0, (hi.y - lo.y + 1) / 32.0)


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
