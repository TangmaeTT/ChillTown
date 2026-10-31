class_name CityBuilder
## Builds the Siam street-corner test block out of boxes: road, sidewalks,
## shophouses with lit windows and Thai signs, skytrain viaduct behind them,
## lamps, trees.
## Placeholder geometry: real props will be modelled, but the layout, scale
## and lighting rules are what this scene tests.
## Axes: road runs along X, shops on +Z, camera looks from -Z.

const SIDEWALK_TOP := 0.12
const ROAD_HALF := 4.0
## Building line on the north side (6 m sidewalk) and the low wall on the south (5.5 m).
const WALK_EDGE := 10.0
const SOUTH_EDGE := -9.5
## Skytrain viaduct: behind the shophouses (which end at z = 14), lifted to clear the roofs.
const RAIL_Z := 17.5
const RAIL_LIFT := 3.5

const WALL_COLORS := ["8f7068", "67565a", "4d6c55", "51444a", "7a6a55", "5a6a78", "6e5f52"]
const AWNING_COLORS := ["b5674d", "4f7a6a", "c9a65a", "6a5a8a", "8f5a5a"]
const WARM := ["ffcf8f", "ffd9a8", "f2b880"]
const SIGNS := {2: "ก๋วยเตี๋ยว", 4: "ร้านกาแฟ", 6: "เสื้อผ้า", 8: "ร้านเกม", 10: "ตัดผม"}
## Shophouses drawn from a ChatGPT facade texture instead of boxes: index -> [texture, sign].
const TEXTURED := {5: ["shophouse_a", ""], 9: ["shophouse_a", "ร้านชำ"]}
## Corner buildings (front + side + roof textures), with an alley (soi) on their -X side.
## Optional third value: interior kit, which turns the shopfront into a hole with a room behind it.
const CORNERS := {4: ["corner_b", "ร้านชำ", "grocery"]}
const SOI_WIDTH := 4.4
## Codex buildings (SiamCity): row index (x = -26.4 + 4.4 i) -> [texture, sign, slots, shop],
## shop = a SiamCity.SHOPS room behind the storefront glass.
## Indices 5-7 are the side road; a 2-slot building also takes the next index.
const CITY_ROW := {
	-2: ["city_shophouse_a", "ร้านเกม", 1, "game"], -1: ["city_pharmacy", "ร้านขายยา", 1, "pharmacy"],
	0: ["city_condo", "", 2], 2: ["city_noodle_shop", "ก๋วยเตี๋ยว", 1, "noodle"],
	4: ["city_shophouse_b", "ร้านชำ", 1, "grocery"],
	8: ["city_mini_mart", "มาร์ท 24 ชม.", 2, "mart"], 10: ["city_cafe", "คาเฟ่", 1, "cafe"],
	11: ["city_shophouse_b", "ตัดผม", 1, "barber"], 12: ["city_gold_shop", "ห้างทอง", 1, "gold"],
	13: ["city_shophouse_old", ""], 14: ["city_shophouse_a", "เสื้อผ้า", 1, "clothes"],
}
const ROW_FIRST := -2
const ROW_LAST := 14
const CROSS_ROW := [5, 6, 7]

## True once the Codex ground tiles are in: the Siam block layout with the side road.
static var _new_city := false


## Movable props placed by the city code, used when no saved layout exists
## (PropLayout). Filled by build().
static var default_props: Array[Dictionary] = []


static func add_default(kind: String, foot: Vector3, yaw := 0.0) -> void:
	default_props.append({"kind": kind, "pos": foot, "yaw": yaw})


static func ground_height(p: Vector3) -> float:
	if absf(p.z) <= ROAD_HALF or (_new_city and SiamCity.on_cross_road(p)):
		return 0.0
	return SIDEWALK_TOP


static func box(parent: Node3D, center: Vector3, size: Vector3, m: Material,
		collide := false, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = m
	mi.position = center
	mi.rotation = rot
	parent.add_child(mi)
	if collide:
		var sb := StaticBody3D.new()
		var cs := CollisionShape3D.new()
		var sh := BoxShape3D.new()
		sh.size = size
		cs.shape = sh
		sb.add_child(cs)
		sb.position = center
		sb.rotation = rot
		parent.add_child(sb)
	return mi


static func sphere(parent: Node3D, center: Vector3, r: float, m: Material,
		squash := Vector3.ONE) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = r
	sm.height = r * 2.0
	sm.radial_segments = 24
	sm.rings = 12
	mi.mesh = sm
	mi.material_override = m
	mi.position = center
	mi.scale = squash
	parent.add_child(mi)
	return mi


const REFLECTION_SHADER := preload("res://assets/shaders/wet_reflection.gdshader")


## Streak of a light reflected on wet ground. `height`: how high the light is.
## In this isometric view the mirrored light shows up 1.73 x height along the
## ground toward the camera (-X, -Z).
static func reflection(parent: Node3D, foot: Vector3, height: float, width: float,
		color: Color, strength: float, night_only := true) -> void:
	var length := 1.73 * height
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(width, length)
	mi.mesh = q
	var m := ShaderMaterial.new()
	m.shader = REFLECTION_SHADER
	m.set_shader_parameter("color", color)
	m.set_shader_parameter("strength", strength)
	m.set_shader_parameter("night_only", night_only)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var dir := Vector3(-1, 0, -1).normalized()
	mi.position = Vector3(foot.x, ground_height(foot) + 0.015, foot.z) + dir * length / 2
	# Lay the quad flat (X), then turn its far end (+Z) toward the camera (Y).
	mi.rotation = Vector3(-PI / 2, -3 * PI / 4, 0)
	parent.add_child(mi)


static func omni(parent: Node3D, pos: Vector3, color: Color, energy: float, range_m: float) -> OmniLight3D:
	var l := OmniLight3D.new()
	l.position = pos
	l.light_color = color
	l.light_energy = energy
	l.omni_range = range_m
	l.omni_attenuation = 1.2
	l.add_to_group("night_lights")
	parent.add_child(l)
	return l


static func build(root: Node3D) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	default_props.clear()
	_new_city = Toon.has_texture("city_asphalt")
	if _new_city:
		SiamCity.ground(root)
	else:
		_ground(root)
	_road_markings(root)
	_shophouses(root, rng)
	if Toon.has_texture("city_viaduct_side"):
		SiamCity.skytrain(root)
	else:
		_skytrain(root)
	_lamps(root)
	_south_side(root)
	_props(root)
	if _new_city:
		SiamCity.utilities(root)
		SiamCity.default_props()


static func _ground(root: Node3D) -> void:
	# Tiled, so the Mobile renderer's per-mesh light limit (8 omni) is never hit.
	var asphalt := Toon.ground("ground_asphalt", Color("2b3038"), 0.85)
	var walk := Toon.ground("ground_pavers", Color("6b6a66"), 0.45)
	var curb := Toon.mat(Color("8a8984"), 0.3)
	for ix in range(-3, 3):
		for iz in range(-3, 3):
			box(root, Vector3(ix * 10 + 5, -0.1, iz * 10 + 5), Vector3(10, 0.2, 10), asphalt)
	for ix in range(-3, 3):
		var x := ix * 10 + 5.0
		for side in [-1.0, 1.0]:
			box(root, Vector3(x, SIDEWALK_TOP / 2, side * 6.0), Vector3(10, SIDEWALK_TOP, 4), walk)
			box(root, Vector3(x, 0.08, side * (ROAD_HALF + 0.09)), Vector3(10, 0.16, 0.18), curb)


static func _road_markings(root: Node3D) -> void:
	var paint := Toon.mat(Color("b8b49c"), 0.5)
	for i in range(-6, 7):
		var x := i * 5.0
		if absf(x) < 3.0:
			continue
		for lane_z in [-2.0, 2.0]:
			box(root, Vector3(x, 0.01, lane_z), Vector3(1.8, 0.02, 0.12), paint)
	var z := -3.6 if not _new_city else 99.0
	while z <= 3.6:
		if absf(z) > 0.6:
			box(root, Vector3(0, 0.012, z), Vector3(3.2, 0.02, 0.45), paint)
		z += 0.9
	# Median divider with a gap at the crossing (old test block only; torad removed it
	# from the Siam city on 31 Oct).
	if not _new_city:
		var divider := Toon.mat(Color("7d7f80"))
		for side in [-1.0, 1.0]:
			box(root, Vector3(side * 16.5, 0.15, 0), Vector3(29, 0.3, 0.6), divider, true)


static func _shophouses(root: Node3D, rng: RandomNumberGenerator) -> void:
	var packed := _packed_row() if _new_city else {}
	for i in range(ROW_FIRST if _new_city else 0, (ROW_LAST if _new_city else 12) + 1):
		_shophouse(root, rng, packed.get(i, -26.4 + 4.4 * i), i)


## Width along X of what stands in row slot i: a Codex building's real facade width (its
## slots share one entry), the soi, or a plain 4.4 m slot. 0 for a wide building's second slot.
static func _row_width(i: int) -> float:
	if CITY_ROW.has(i - 1) and CITY_ROW[i - 1].size() > 2 and CITY_ROW[i - 1][2] > 1:
		return 0.0
	if CITY_ROW.has(i):
		var spec: Array = CITY_ROW[i]
		var slots: int = spec[2] if spec.size() > 2 else 1
		return Toon.texture_size_m(spec[0] + "_front").x if Toon.has_texture(spec[0] + "_front") else 4.4 * slots
	if CORNERS.has(i + 1):
		return SOI_WIDTH
	return 4.4


## Centre x of each row item with the buildings packed wall to wall. Codex facades are not
## 4.4 m wide (3.3 to 5.1 m), so on the slot grid they left gaps or overlapped. Each block
## starts flush at the side road and runs outward; the far end of the row takes the slack.
static func _packed_row() -> Dictionary:
	var out := {}
	var west := range(ROW_FIRST, CROSS_ROW[0])
	west.reverse()
	for block in [[west, -26.4 + 4.4 * CROSS_ROW[0] - 2.2, -1.0],
			[range(CROSS_ROW[-1] + 1, ROW_LAST + 1), -26.4 + 4.4 * CROSS_ROW[-1] + 2.2, 1.0]]:
		var edge: float = block[1]
		var dir: float = block[2]
		for i in block[0]:
			var w := _row_width(i)
			if w == 0.0:
				continue
			out[i] = edge + dir * w / 2
			edge += dir * w
	return out


static func face(parent: Node3D, center: Vector3, size: Vector2, yaw: float, m: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = size
	mi.mesh = q
	mi.material_override = m
	mi.position = center
	mi.rotation.y = yaw
	parent.add_child(mi)
	return mi


static func _textured_shophouse(root: Node3D, x: float, tex: String, sign: String) -> void:
	var size := Toon.texture_size_m(tex)
	var front := WALK_EDGE
	box(root, Vector3(x, size.y / 2 - 0.3, front + 3), Vector3(4.2, size.y - 0.6, 6), Toon.mat(Color("7f6158")), true)
	# Quad faces +Z by default; turn it to face the street (-Z).
	face(root, Vector3(x, size.y / 2, front - 0.01), size, PI, Toon.textured(tex))
	omni(root, Vector3(x, 1.6, front - 0.8), Color("ffbf80"), 0.9, 4.5)
	reflection(root, Vector3(x, 0, front - 0.3), 2.4, 2.0, Color("ffbf80"), 0.3)
	if sign != "":
		# The facade's empty signboard band sits about a third of the way up.
		var l := Toon.label(sign, 72, Color(1.7, 1.4, 1.0), 0)
		l.pixel_size = 0.006
		l.position = Vector3(x, size.y * 0.334, front - 0.03)
		l.rotation.y = PI
		root.add_child(l)


## Box textured on the three faces the camera sees: front (-Z), side (-X) and roof.
## The front sits on the sidewalk edge; the side texture's width sets the depth.
static func solid(parent: Node3D, center: Vector3, size: Vector3) -> void:
	var sb := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var sh := BoxShape3D.new()
	sh.size = size
	cs.shape = sh
	sb.add_child(cs)
	sb.position = center
	parent.add_child(sb)


static func _corner_building(root: Node3D, x: float, tex: String, sign: String, kit := "") -> void:
	var front_m := Toon.texture_size_m(tex + "_front")
	var depth := Toon.texture_size_m(tex + "_side").x
	var h := front_m.y
	var front := WALK_EDGE
	var c := Vector3(x, h / 2, front + depth / 2)
	if kit == "":
		box(root, c, Vector3(front_m.x - 0.02, h - 0.02, depth - 0.02), Toon.mat(Color("7f6158")), true)
	else:
		# Faces only, so the shopfront hole looks into a real room.
		solid(root, c, Vector3(front_m.x, h, depth))
		var hole := Toon.hole_rect_m(tex + "_front")
		# Texture x runs from the facade's +X edge (the quad is turned to face -Z).
		PropKit.interior(root, kit, x + front_m.x / 2 - hole.get_center().x, front,
				front_m.x - 0.3, 4.0, SIDEWALK_TOP)
		_dress_corner(root, x, front, front_m, depth)
	var front_face := face(root, Vector3(x, h / 2, front - 0.01), front_m, PI, Toon.textured(tex + "_front"))
	# Dev: `-- --xray` hides corner fronts to check the room layout behind them.
	front_face.visible = not OS.get_cmdline_user_args().has("--xray")
	face(root, Vector3(x - front_m.x / 2 - 0.01, h / 2, c.z), Vector2(depth, h), -PI / 2, Toon.textured(tex + "_side"))
	var roof := face(root, Vector3(x, h + 0.01, c.z), Vector2(front_m.x, depth), 0.0, Toon.textured(tex + "_roof"))
	roof.rotation.x = -PI / 2
	omni(root, Vector3(x, 1.6, front - 0.8), Color("ffbf80"), 0.9, 4.5)
	reflection(root, Vector3(x, 0, front - 0.3), 2.4, 2.0, Color("ffbf80"), 0.3)
	if sign != "":
		var l := Toon.label(sign, 72, Color(1.7, 1.4, 1.0), 0)
		l.pixel_size = 0.006
		l.position = Vector3(x, h * 0.334, front - 0.03)
		l.rotation.y = PI
		root.add_child(l)


## Wall pieces on a corner building: AC units and a meter box on the alley
## wall, pipes and conduit, plants and crates by the door, laundry on the
## ledge, and a utility pole on the corner with wires to the building.
static func _dress_corner(root: Node3D, x: float, front: float, size: Vector2, depth: float) -> void:
	var side_x := x - size.x / 2
	var grey := Color("5a6a78")
	var dark := Color("3a3d42")
	# Front of these pieces faces the alley (-X).
	add_default("ac", Vector3(side_x - 0.15, 6.0, front + 2.4), PI / 2)
	add_default("ac", Vector3(side_x - 0.15, 3.3, front + 4.8), PI / 2)
	add_default("meter", Vector3(side_x - 0.13, 1.4, front + 0.9), PI / 2)
	PropKit.pipe(root, Vector3(side_x - 0.08, SIDEWALK_TOP, front + 0.25), Vector3(side_x - 0.08, size.y - 0.3, front + 0.25), 0.06, grey)
	PropKit.pipe(root, Vector3(x + size.x / 2 - 0.15, SIDEWALK_TOP, front - 0.08), Vector3(x + size.x / 2 - 0.15, size.y - 0.3, front - 0.08), 0.05, grey)
	PropKit.pipe(root, Vector3(side_x - 0.04, 2.1, front + 0.9), Vector3(side_x - 0.04, 2.1, front + depth - 0.3), 0.025, dark)
	PropKit.pipe(root, Vector3(side_x - 0.04, 2.1, front + 0.9), Vector3(side_x - 0.04, 6.1, front + 0.9), 0.025, dark)
	PropKit.pipe(root, Vector3(side_x - 0.04, 6.1, front + 0.9), Vector3(side_x - 0.04, 6.1, front + 2.0), 0.025, dark)
	add_default("fern", Vector3(x + size.x / 2 - 0.35, SIDEWALK_TOP, front - 0.3))
	add_default("tall", Vector3(x + size.x / 2 - 0.85, SIDEWALK_TOP, front - 0.3))
	add_default("crates", Vector3(x - size.x / 2 + 0.35, SIDEWALK_TOP, front - 0.25))
	# Bush on the left end of the left 2nd-floor window sill (sill 4.45 m up,
	# window 0.6-1.8 m in from the facade's left edge as seen from the street,
	# which is world +X); laundry rack up on the roof.
	add_default("bush", Vector3(x + size.x / 2 - 0.85, 4.45, front - 0.15))
	add_default("rack", Vector3(x + 0.4, size.y, front + 1.6))
	if _new_city and Toon.has_texture("city_utility_pole_front"):
		return
	var top := PropKit.utility_pole(root, Vector3(side_x - 1.2, SIDEWALK_TOP, front - 1.3))
	PropKit.wire(root, top, Vector3(side_x - 0.05, 7.2, front + 0.5), 0.5)
	PropKit.wire(root, top + Vector3(0.5, 0, 0), Vector3(side_x - 0.05, 6.8, front + 1.5), 0.6)
	PropKit.wire(root, top + Vector3(-0.6, 0, 0), top + Vector3(-13.0, 0, 0), 1.1)
	PropKit.wire(root, top + Vector3(0.6, -0.8, 0), top + Vector3(13.0, -0.8, 0), 1.2)
	PropKit.wire(root, top + Vector3(-0.3, -0.8, 0), top + Vector3(-13.0, -0.8, 0.3), 1.3)


## Paved alley between two shophouses, running back from the sidewalk.
static func _soi(root: Node3D, x: float) -> void:
	var floor := Toon.ground("city_soi_concrete", Color.WHITE, 0.5) if _new_city and Toon.has_texture("city_soi_concrete") 			else Toon.ground("ground_pavers", Color("615f5c"), 0.5)
	box(root, Vector3(x, SIDEWALK_TOP / 2, WALK_EDGE + 4), Vector3(SOI_WIDTH, SIDEWALK_TOP, 8), floor)


## Does a Codex building stand in row slot i (its own, or the second slot of a wide one)?
static func _slot_built(i: int) -> bool:
	if CITY_ROW.has(i):
		return true
	return CITY_ROW.has(i - 1) and CITY_ROW[i - 1].size() > 2 and CITY_ROW[i - 1][2] > 1


static func _shophouse(root: Node3D, rng: RandomNumberGenerator, x: float, idx: int) -> void:
	if _new_city and idx in CROSS_ROW:
		return
	if _new_city and CITY_ROW.has(idx - 1) and CITY_ROW[idx - 1].size() > 2 and CITY_ROW[idx - 1][2] > 1 			and Toon.has_texture(CITY_ROW[idx - 1][0] + "_front"):
		return                           # second slot of a wide building
	if _new_city and CITY_ROW.has(idx) and Toon.has_texture(CITY_ROW[idx][0] + "_front"):
		var spec: Array = CITY_ROW[idx]
		var slots: int = spec[2] if spec.size() > 2 else 1
		var shop: String = spec[3] if spec.size() > 3 else ""
		# Its -X wall shows when nothing stands west of it: the row's end, the side road, a soi.
		var exposed := not _slot_built(idx - 1)
		SiamCity.building(root, x, spec[0], spec[1], 0.01 * (idx % 2), shop, exposed)
		rng.randi()
		return
	if CORNERS.has(idx + 1):
		_soi(root, x)
		return
	if CORNERS.has(idx):
		var spec: Array = CORNERS[idx]
		_corner_building(root, x, spec[0], spec[1], spec[2] if spec.size() > 2 else "")
		return
	if TEXTURED.has(idx):
		_textured_shophouse(root, x, TEXTURED[idx][0], TEXTURED[idx][1])
		rng.randi()  # keep the other houses' random looks unchanged
		return
	var upper := rng.randi_range(1, 3)
	var h := 3.2 + 2.6 * upper + 0.6
	var wall := Color(WALL_COLORS[rng.randi() % WALL_COLORS.size()])
	var front := WALK_EDGE
	box(root, Vector3(x, h / 2, front + 3), Vector3(4.2, h, 6), Toon.mat(wall), true)
	box(root, Vector3(x, h + 0.1, front + 3), Vector3(4.35, 0.2, 6.1), Toon.mat(wall.darkened(0.25)))

	var dark_glass := Toon.mat(Color("1c2430"), 0.6)
	for f in upper:
		var y := 3.2 + f * 2.6 + 1.3
		for wx in [-0.95, 0.95]:
			var m: Material = dark_glass
			if rng.randf() < 0.45:
				m = Toon.glow(Color(WARM[rng.randi() % WARM.size()]), rng.randf_range(1.2, 2.5))
			box(root, Vector3(x + wx, y, front - 0.03), Vector3(1.0, 1.2, 0.06), m)
			if rng.randf() < 0.25 and (f > 0 or not SIGNS.has(idx)):
				box(root, Vector3(x + wx, y - 0.95, front - 0.18), Vector3(0.7, 0.45, 0.32), Toon.mat(Color("c9c9c4")))

	var has_sign := SIGNS.has(idx)
	if has_sign:
		var warm := Color(WARM[idx % WARM.size()])
		box(root, Vector3(x, 1.35, front - 0.03), Vector3(3.4, 2.5, 0.06), Toon.glow(warm, 1.0))
		omni(root, Vector3(x, 1.8, front - 1.0), Color("ffbf80"), 0.9, 4.5)
		reflection(root, Vector3(x, 0, front - 0.3), 2.5, 2.0, warm, 0.25)
	else:
		var shutter := Toon.mat(Color("6e737b"))
		var groove := Toon.mat(Color("4a4e55"))
		box(root, Vector3(x, 1.35, front - 0.03), Vector3(3.4, 2.5, 0.06), shutter)
		var gy := 0.3
		while gy < 2.6:
			box(root, Vector3(x, gy, front - 0.07), Vector3(3.4, 0.03, 0.03), groove)
			gy += 0.25

	var awning := Color(AWNING_COLORS[rng.randi() % AWNING_COLORS.size()])
	box(root, Vector3(x, 2.95, front - 0.62), Vector3(4.0, 0.1, 1.3), Toon.mat(awning), false, Vector3(-0.3, 0, 0))

	if has_sign:
		box(root, Vector3(x, 3.75, front - 0.06), Vector3(3.2, 0.8, 0.12), Toon.mat(Color("2a2f38")))
		var l := Toon.label(SIGNS[idx], 72, Color(1.7, 1.4, 1.0), 0)
		l.pixel_size = 0.006
		l.position = Vector3(x, 3.75, front - 0.14)
		l.rotation.y = PI
		root.add_child(l)


static func _skytrain(root: Node3D) -> void:
	# Runs behind the shophouse row (torad, 30 Oct): over the street it hid
	# the shopfronts from the isometric camera. From here it reads as a
	# skyline above the roofs and never covers the player.
	var o := Vector3(0, RAIL_LIFT, RAIL_Z)
	var concrete := Toon.mat(Color("8c9096"))
	var concrete_dark := Toon.mat(Color("6c7076"))
	box(root, o + Vector3(0, 8.95, 0), Vector3(64, 0.9, 5.5), concrete)
	box(root, o + Vector3(0, 9.7, -2.7), Vector3(64, 0.6, 0.15), concrete_dark)
	box(root, o + Vector3(0, 9.7, 2.7), Vector3(64, 0.6, 0.15), concrete_dark)
	var rail := Toon.mat(Color("3a3d42"))
	for z in [-1.5, -0.6, 0.6, 1.5]:
		box(root, o + Vector3(0, 9.47, z), Vector3(64, 0.12, 0.1), rail)
	var strip := Toon.glow(Color("e8f0ff"), 1.4)
	var pillar_h := 8.5 + RAIL_LIFT
	for px in [-24.0, -12.0, 0.0, 12.0, 24.0]:
		box(root, Vector3(px, pillar_h / 2, RAIL_Z), Vector3(1.1, pillar_h, 1.1), concrete)
		box(root, o + Vector3(px, 8.2, 0), Vector3(3.2, 0.6, 1.6), concrete_dark)
	for sx in range(-27, 28, 6):
		box(root, o + Vector3(sx, 8.47, -2.0), Vector3(1.6, 0.05, 0.12), strip)
		box(root, o + Vector3(sx, 8.47, 2.0), Vector3(1.6, 0.05, 0.12), strip)


static func _lamp(root: Node3D, x: float, z: float) -> void:
	if _new_city and SiamCity.lamp(root, x, z):
		return
	var pole := Toon.mat(Color("3a3f45"))
	var toward := -signf(z)
	box(root, Vector3(x, SIDEWALK_TOP + 2.1, z), Vector3(0.14, 4.2, 0.14), pole, true)
	box(root, Vector3(x, 4.3, z + toward * 0.45), Vector3(0.1, 0.1, 0.9), pole)
	box(root, Vector3(x, 4.22, z + toward * 0.9), Vector3(0.38, 0.14, 0.26), Toon.glow(Color("ffd59a"), 4.0))
	var lamp := omni(root, Vector3(x, 3.9, z + toward * 0.9), Color("ffc983"), 2.6, 6.5)
	lamp.add_to_group("street_lamps")
	reflection(root, Vector3(x, 0, z + toward * 0.9), 4.2, 0.5, Color("ffc983"), 0.9)


static func _lamps(root: Node3D) -> void:
	for x in [-30.0, -18.0, -6.0, 6.0, 18.0, 30.0]:
		_lamp(root, x, 4.5)
	for x in [-36.0, -24.0, -12.0, 0.0, 12.0, 24.0, 36.0]:
		_lamp(root, x, -4.5)


static func _south_side(root: Node3D) -> void:
	var wall := Toon.mat(Color("5c5a58"))
	var ivy := Toon.mat(Color("3b5849"))
	var wz := SOUTH_EDGE - 0.25 if _new_city else -8.25
	var wl := SiamCity.EAST_END - SiamCity.WEST_END if _new_city else 64.0
	box(root, Vector3(0, 0.3, wz), Vector3(wl, 0.6, 0.3), wall, true)
	box(root, Vector3(0, 0.66, wz), Vector3(wl, 0.14, 0.42), ivy)
	var trunk := Toon.mat(Color("51444a"))
	var leaf_a := Toon.occluder(Color("3b5849"), 0.03)
	var leaf_b := Toon.occluder(Color("4d6c55"), 0.03)
	if _new_city and Toon.has_texture("city_planter_tree_front"):
		return
	for x in [-18.0, -6.0, 6.0, 18.0]:
		box(root, Vector3(x, 0.32, -7.3), Vector3(1.3, 0.4, 1.3), wall, true)
		box(root, Vector3(x, 1.2, -7.3), Vector3(0.22, 1.6, 0.22), trunk)
		sphere(root, Vector3(x, 2.3, -7.3), 1.0, leaf_a, Vector3(1, 0.85, 1))
		sphere(root, Vector3(x + 0.2, 3.0, -7.4), 0.65, leaf_b, Vector3(1, 0.9, 1))


static func _props(root: Node3D) -> void:
	# Vending machine against the shuttered house next to the textured shop (index 6 -> x = 0).
	add_default("vending", Vector3(5.3 if _new_city else 1.3, SIDEWALK_TOP, 9.6 if _new_city else WALK_EDGE - 0.4))

	if _new_city and Toon.has_texture("city_bench_front"):
		# Parked in the curb lanes; the inner lanes carry the traffic (SiamCity.traffic).
		SiamCity.vehicle(root, "city_taxi_pink", Vector3(8, 0, -3.0))
		SiamCity.vehicle(root, "city_sedan_white", Vector3(-26, 0, -3.0))
		SiamCity.vehicle(root, "city_taxi_green", Vector3(-20, 0, 3.0), PI)
		SiamCity.vehicle(root, "city_tuktuk", Vector3(16, 0, 3.0), PI)
		SiamCity.vehicle(root, "city_pickup", Vector3(34, 0, 3.0), PI)
		SiamCity.street_marks(root)
		SiamCity.traffic(root)
		SiamCity.pedestrians(root)
		return
	# Bench on the south sidewalk.
	var wood := Toon.mat(Color("8f7068"))
	var metal := Toon.mat(Color("3a3f45"))
	box(root, Vector3(-3, 0.55, -6.6), Vector3(1.8, 0.08, 0.5), wood, true)
	box(root, Vector3(-3, 0.85, -6.85), Vector3(1.8, 0.4, 0.06), wood)
	for bx in [-3.75, -2.25]:
		box(root, Vector3(bx, 0.33, -6.6), Vector3(0.08, 0.4, 0.45), metal)

	# Noodle cart outside the noodle shop (index 2 -> x = -17.6).
	var cx := -17.6
	box(root, Vector3(cx, 0.6, 6.6), Vector3(1.6, 0.9, 0.8), Toon.mat(Color("8f5a5a")), true)
	box(root, Vector3(cx, 1.3, 6.6), Vector3(1.4, 0.5, 0.7), Toon.glow(Color("ffe2b0"), 1.2))
	box(root, Vector3(cx + 0.7, 1.6, 6.6), Vector3(0.05, 1.6, 0.05), metal)
	var umbrella := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.05
	cyl.bottom_radius = 1.0
	cyl.height = 0.35
	umbrella.mesh = cyl
	umbrella.material_override = Toon.mat(Color("c9a65a"))
	umbrella.position = Vector3(cx + 0.7, 2.5, 6.6)
	root.add_child(umbrella)

	# Parked taxi, muted pink (GDD: pink / green-yellow taxis).
	var taxi := Toon.mat(Color("c98a9a"), 0.5)
	box(root, Vector3(8, 0.55, -2.3), Vector3(3.6, 0.7, 1.6), taxi, true)
	box(root, Vector3(7.8, 1.15, -2.3), Vector3(2.0, 0.6, 1.4), Toon.mat(Color("27303a"), 0.7))
	box(root, Vector3(7.8, 1.5, -2.3), Vector3(0.6, 0.14, 0.3), Toon.glow(Color("ffe9a8"), 2.0))
	for hz in [-2.85, -1.75]:
		box(root, Vector3(9.82, 0.6, hz), Vector3(0.05, 0.16, 0.3), Toon.glow(Color("fff1d0"), 3.0))
	var tyre := Toon.mat(Color("1a1c20"))
	for wx in [6.8, 9.2]:
		for wz in [-3.1, -1.5]:
			box(root, Vector3(wx, 0.3, wz), Vector3(0.6, 0.6, 0.2), tyre)
