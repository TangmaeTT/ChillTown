class_name PropKit
## Separate 3D pieces that give buildings depth (Tokyo Midnight lesson): boxes
## textured on every face, camera-facing cutout cards, code-drawn pipes and
## sagging wires, and a shop interior room seen through the facade's hole.
## Textures come from tools/texture_from_ai.py (32 px per metre); the size of
## a piece is taken from its textures.

## A card faces the camera, which looks along (+X, +Z).
const CARD_YAW := -3.0 * PI / 4.0

## Props the layout editor can place: kind -> [builder, texture, Thai name].
const CATALOG := {
	"ac": ["box", "kit_ac", "แอร์"],
	"meter": ["box", "kit_meter", "มิเตอร์ไฟ"],
	"crates": ["box", "kit_crates", "ลังซ้อน"],
	"fern": ["card", "kit_fern", "เฟิร์น"],
	"bush": ["card", "kit_bush", "กระถางพุ่ม"],
	"tall": ["card", "kit_tall", "ต้นไม้สูง"],
	"rack": ["card", "kit_rack", "ราวตากผ้า"],
	"shelf": ["box", "grocery_shelf", "ชั้นวางของ"],
	"counter": ["box", "grocery_counter", "เคาน์เตอร์"],
	"fridge": ["box", "grocery_fridge", "ตู้แช่"],
	"vending": ["vending", "vending", "ตู้กดน้ำ"],
	# Codex street props (tools/city_batch.py)
	"spirit_house": ["box", "city_spirit_house", "ศาลพระภูมิ"],
	"noodle_cart": ["box", "city_noodle_cart", "รถเข็นก๋วยเตี๋ยว"],
	"fruit_cart": ["box", "city_fruit_cart", "รถเข็นผลไม้"],
	"grill_cart": ["box", "city_grill_cart", "รถเข็นหมูปิ้ง"],
	"lottery_stand": ["box", "city_lottery_stand", "แผงลอตเตอรี่"],
	"table_stools": ["box", "city_table_stools", "โต๊ะ+เก้าอี้"],
	"kiosk_drinks": ["box", "city_kiosk_drinks", "ซุ้มน้ำ"],
	"kiosk_flowers": ["box", "city_kiosk_flowers", "ซุ้มดอกไม้"],
	"police_box": ["box", "city_police_box", "ป้อมตำรวจ"],
	"bus_stop": ["box", "city_bus_stop", "ป้ายรถเมล์"],
	"moto_stand": ["box", "city_moto_stand", "วินมอไซค์"],
	"clock_post": ["box", "city_clock_post", "เสานาฬิกา"],
	"bench": ["box", "city_bench", "ม้านั่ง"],
	"trash_bins": ["box", "city_trash_bins", "ถังขยะ"],
	"phone_booth": ["box", "city_phone_booth", "ตู้โทรศัพท์"],
	"planter_tree": ["box", "city_planter_tree", "กระบะต้นไม้"],
	"rain_tree": ["card", "city_rain_tree", "ต้นจามจุรี"],
	"sign_aframe": ["box", "city_sign_aframe", "ป้ายตั้งพื้น"],
	"sign_lightbox": ["box", "city_sign_lightbox", "กล่องไฟ"],
	"barrier_water": ["box", "city_barrier_water", "แผงกั้นน้ำ"],
	"cone": ["box", "city_cone", "กรวย"],
	"crowd_barrier": ["box", "city_crowd_barrier", "รั้วเหล็กกั้น"],
	"ac_unit": ["box", "city_ac_unit", "แอร์ตัวนอก"],
	"meter_box": ["box", "city_meter_box", "กล่องมิเตอร์"],
	"bin_twin": ["box", "city_bin_twin", "ถังขยะ 2 ช่อง"],
	"motorbike": ["box", "city_motorbike", "มอเตอร์ไซค์"],
	# Shop interiors (SiamCity.SHOPS)
	"mart_shelf": ["box", "city_mart_shelf", "ชั้นขนม"],
	"mart_fridge": ["box", "city_mart_fridge", "ตู้แช่เครื่องดื่ม"],
	"mart_counter": ["box", "city_mart_counter", "เคาน์เตอร์คิดเงิน"],
	"cafe_counter": ["box", "city_cafe_counter", "เคาน์เตอร์กาแฟ"],
	"cafe_table": ["box", "city_cafe_table", "โต๊ะคาเฟ่"],
	"pharmacy_shelf": ["box", "city_pharmacy_shelf", "ชั้นยา"],
	"gold_counter": ["box", "city_gold_counter", "ตู้โชว์ทอง"],
	"gold_wall": ["box", "city_gold_wall", "ตู้ทองติดผนัง"],
	"noodle_station": ["box", "city_noodle_station", "เตาก๋วยเตี๋ยว"],
	"noodle_table": ["box", "city_noodle_table", "โต๊ะสแตนเลส"],
	"stool_stack": ["box", "city_stool_stack", "เก้าอี้แดงซ้อน"],
	"arcade_cabinet": ["box", "city_arcade_cabinet", "ตู้เกม"],
	"claw_machine": ["box", "city_claw_machine", "ตู้คีบตุ๊กตา"],
	"barber_station": ["box", "city_barber_station", "เก้าอี้ตัดผม"],
	"clothes_rack": ["box", "city_clothes_rack", "ราวเสื้อผ้า"],
	"water_tank": ["box", "city_water_tank", "แท็งก์น้ำ"],
	"meter_cluster": ["box", "city_meter_cluster", "ชุดมิเตอร์"],
}


## Catalogue entries whose textures are in the project (Codex art arrives over time).
static func available(kind: String) -> bool:
	var spec: Array = CATALOG[kind]
	return Toon.has_texture(spec[1] if spec[0] == "card" else spec[1] + "_front")


## Places a catalogue prop with its base centred on `foot`. The returned node
## carries meta "kind" and "size" (bounding box, metres) for the editor.
static func spawn(parent: Node3D, kind: String, foot: Vector3, yaw := 0.0) -> Node3D:
	var spec: Array = CATALOG[kind]
	var node: Node3D
	match spec[0]:
		"card":
			node = Node3D.new()
			node.position = foot
			parent.add_child(node)
			card(node, spec[1], Vector3.ZERO)
		"vending":
			node = textured_box(parent, spec[1], foot, yaw)
			_vending_fx(node)
		_:
			node = textured_box(parent, spec[1], foot, yaw)
	if kind == "grill_cart":
		_smoke(node, Toon.texture_size_m(spec[1] + "_front").y * 0.55)
	node.set_meta("kind", kind)
	node.set_meta("size", size_of(kind))
	return node


static func size_of(kind: String) -> Vector3:
	var spec: Array = CATALOG[kind]
	if spec[0] == "card":
		var s := Toon.texture_size_m(spec[1])
		return Vector3(s.x, s.y, 0.1)
	var front := Toon.texture_size_m(spec[1] + "_front")
	return Vector3(front.x, front.y, Toon.texture_size_m(spec[1] + "_side").x)


## Turns a placed prop; its reflection (if any) keeps pointing at the camera.
static func set_yaw(node: Node3D, yaw: float) -> void:
	node.rotation.y = yaw
	if node.has_node("fx"):
		node.get_node("fx").rotation.y = -yaw


## Vending machine glow: a small light in front and a wet-ground reflection
## under a counter-rotated holder, since reflections must face the camera.
static func _vending_fx(node: Node3D) -> void:
	var size := Toon.texture_size_m("vending_front")
	var depth := Toon.texture_size_m("vending_side").x
	CityBuilder.omni(node, Vector3(0, size.y / 2 + 0.2, -depth / 2 - 0.5), Color("e8f4ff"), 0.6, 2.5)
	var fx := Node3D.new()
	fx.name = "fx"
	node.add_child(fx)
	fx.rotation.y = -node.rotation.y
	CityBuilder.reflection(fx, Vector3.ZERO, size.y, 0.8, Color("f2ead0"), 0.6)


## Grill smoke: soft grey puffs rising off the coals and drifting with the breeze.
static func _smoke(node: Node3D, height: float) -> void:
	var p := GPUParticles3D.new()
	p.amount = 24
	p.lifetime = 2.6
	p.position = Vector3(0, height, 0)
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(0.35, 0.02, 0.15)
	pm.direction = Vector3(0.15, 1, 0.1)
	pm.spread = 12.0
	pm.initial_velocity_min = 0.35
	pm.initial_velocity_max = 0.6
	pm.gravity = Vector3(0.12, 0.05, 0.08)
	pm.scale_min = 0.6
	pm.scale_max = 1.0
	var grow := Curve.new()
	grow.add_point(Vector2(0, 0.4))
	grow.add_point(Vector2(1, 1.6))
	var ct := CurveTexture.new()
	ct.curve = grow
	pm.scale_curve = ct
	var fade := Gradient.new()
	fade.set_color(0, Color(0.85, 0.85, 0.82, 0.45))
	fade.set_color(1, Color(0.85, 0.85, 0.82, 0.0))
	var gt := GradientTexture1D.new()
	gt.gradient = fade
	pm.color_ramp = gt
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.32, 0.32)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.vertex_color_use_as_albedo = true
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	q.material = m
	p.draw_pass_1 = q
	node.add_child(p)


static func _face(parent: Node3D, center: Vector3, size: Vector2, rot: Vector3, tex: String) -> MeshInstance3D:
	var mi := CityBuilder.face(parent, center, size, 0.0, Toon.textured(tex))
	mi.rotation = rot
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_DOUBLE_SIDED
	return mi


static func _has(tex: String) -> bool:
	return ResourceLoader.exists("res://assets/textures/%s_albedo.png" % tex)


## Box from <name>_front / _side / _top textures. `foot` is the centre of its
## base; local -Z is the front, turned by `yaw` (PI/2 puts the front on -X).
## A solid voxel model carved from the views (tools/voxel_from_views.py), when there is one.
static func voxel(parent: Node3D, name: String, foot: Vector3, yaw := 0.0) -> Node3D:
	var node: Node3D = (load("res://assets/models/%s.glb" % name) as PackedScene).instantiate()
	node.position = foot
	node.rotation.y = yaw
	parent.add_child(node)
	var m: ShaderMaterial = Toon.voxel_tex(name) if FileAccess.file_exists("res://assets/models/%s.vx.json" % name) else Toon.vcolor()
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).material_override = m
	return node


static func has_voxel(name: String) -> bool:
	return ResourceLoader.exists("res://assets/models/%s.glb" % name)


## A box faced with the front/side/top textures, or the voxel model carved from them.
static func textured_box(parent: Node3D, name: String, foot: Vector3, yaw := 0.0) -> Node3D:
	if has_voxel(name):
		return voxel(parent, name, foot, yaw)
	var front := Toon.texture_size_m(name + "_front")
	var depth := Toon.texture_size_m(name + "_side").x
	var w := front.x
	var h := front.y
	var node := Node3D.new()
	node.position = foot
	node.rotation.y = yaw
	parent.add_child(node)
	_face(node, Vector3(0, h / 2, -depth / 2), front, Vector3(0, PI, 0), name + "_front")
	_face(node, Vector3(-w / 2, h / 2, 0), Vector2(depth, h), Vector3(0, -PI / 2, 0), name + "_side")
	_face(node, Vector3(w / 2, h / 2, 0), Vector2(depth, h), Vector3(0, PI / 2, 0), name + "_side")
	if _has(name + "_top"):
		_face(node, Vector3(0, h, 0), Vector2(w, depth), Vector3(-PI / 2, PI, 0), name + "_top")
	return node


## Flat cutout standing on `foot`, turned to face the camera.
static func card(parent: Node3D, name: String, foot: Vector3) -> MeshInstance3D:
	var size := Toon.texture_size_m(name)
	return _face(parent, foot + Vector3(0, size.y / 2, 0), size, Vector3(0, CARD_YAW, 0), name)


static func pipe(parent: Node3D, a: Vector3, b: Vector3, radius: float, color: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = radius
	cyl.bottom_radius = radius
	cyl.height = a.distance_to(b)
	cyl.radial_segments = 6
	cyl.rings = 1
	mi.mesh = cyl
	mi.material_override = Toon.mat(color, 0.3)
	parent.add_child(mi)
	mi.global_position = (a + b) / 2
	var up := (b - a).normalized()
	var side := up.cross(Vector3.FORWARD if absf(up.z) < 0.9 else Vector3.RIGHT).normalized()
	mi.global_basis = Basis(side, up, side.cross(up)).orthonormalized()
	return mi


## Cable hanging between two points, sagging `sag` metres in the middle.
static func wire(parent: Node3D, a: Vector3, b: Vector3, sag: float, color := Color("1d1f24")) -> void:
	var steps := 8
	var prev := a
	for i in range(1, steps + 1):
		var t := float(i) / steps
		var p := a.lerp(b, t) + Vector3.DOWN * sag * 4.0 * t * (1.0 - t)
		pipe(parent, prev, p, 0.018, color)
		prev = p


## Bangkok concrete utility pole with crossarms and a transformer drum.
## Returns the point wires attach to.
static func utility_pole(parent: Node3D, foot: Vector3, height := 8.5) -> Vector3:
	var concrete := Toon.mat(Color("8a8984"))
	CityBuilder.box(parent, foot + Vector3(0, height / 2, 0), Vector3(0.28, height, 0.28), concrete, true)
	for y in [height - 0.4, height - 1.2]:
		CityBuilder.box(parent, foot + Vector3(0, y, 0), Vector3(1.6, 0.12, 0.12), Toon.mat(Color("5c5a58")))
	var drum := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.28
	cyl.bottom_radius = 0.28
	cyl.height = 0.8
	drum.mesh = cyl
	drum.material_override = Toon.mat(Color("6c7580"))
	drum.position = foot + Vector3(0.38, height - 2.4, 0)
	parent.add_child(drum)
	return foot + Vector3(0, height - 0.45, 0)


## Shop room behind a facade hole: shelf-wall texture on the back wall and on
## the right wall (the isometric view looks diagonally through the hole, so the
## right wall is what you mostly see), floor, ceiling, a tube light that is
## always on, and the kit's shelf, counter and fridge. `front_z` is the facade
## plane; the room runs +Z. Depth should match the back-wall texture's width.
## The floor sits at sidewalk height so props placed anywhere stand on it.
static func interior(parent: Node3D, kit: String, center_x: float, front_z: float,
		width: float, depth: float, floor_y: float, height := 2.6) -> void:
	var wall := Toon.mat(Color("8a7a68"))
	var back_z := front_z + depth
	var cz := front_z + depth / 2
	CityBuilder.box(parent, Vector3(center_x, floor_y - 0.05, cz), Vector3(width, 0.1, depth), Toon.mat(Color("6f6a62"), 0.3))
	var ceiling := CityBuilder.box(parent, Vector3(center_x, floor_y + height + 0.05, cz), Vector3(width, 0.1, depth), Toon.mat(Color("4a443e")))
	ceiling.visible = not OS.get_cmdline_user_args().has("--xray")
	for sx in [-1.0, 1.0]:
		CityBuilder.box(parent, Vector3(center_x + sx * (width / 2 + 0.05), floor_y + height / 2, cz),
				Vector3(0.1, height, depth), wall)
	_face(parent, Vector3(center_x, floor_y + height / 2, back_z - 0.01), Vector2(width, height), Vector3(0, PI, 0), kit + "_back")
	_face(parent, Vector3(center_x + width / 2 - 0.01, floor_y + height / 2, cz), Vector2(depth, height), Vector3(0, -PI / 2, 0), kit + "_back")
	CityBuilder.box(parent, Vector3(center_x, floor_y + height - 0.08, cz), Vector3(1.2, 0.06, 0.12), Toon.glow(Color("f4f6ea"), 3.0))
	var light := OmniLight3D.new()
	light.position = Vector3(center_x, floor_y + height - 0.4, cz)
	light.light_color = Color("fff1d6")
	light.light_energy = 1.4
	light.omni_range = depth + 1.5
	parent.add_child(light)

	# What the camera can see inside: a strip running from the hole toward the
	# +X wall (screen left), and only about 1.5 m deep for anything tall,
	# because the wall above the hole cuts off the view down into the room.
	# So the pieces sit near the front, spread across the screen and layered
	# by height: fridge at the front right, counter front centre, the
	# freestanding shelf just behind on the left, rising above the counter.
	# Movable: these go into the default layout for the editor.
	CityBuilder.add_default("fridge", Vector3(center_x - width / 2 + 0.55, floor_y, front_z + 0.5))
	CityBuilder.add_default("counter", Vector3(center_x + 0.15, floor_y, front_z + 0.5))
	CityBuilder.add_default("shelf", Vector3(center_x + 1.15, floor_y, front_z + 1.1))
