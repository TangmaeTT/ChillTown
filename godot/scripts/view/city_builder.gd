class_name CityBuilder
## Builds the Siam street-corner test block out of boxes: road, sidewalks,
## shophouses with lit windows and Thai signs, skytrain viaduct behind them,
## lamps, trees.
## Placeholder geometry: real props will be modelled, but the layout, scale
## and lighting rules are what this scene tests.
## Axes: road runs along X, shops on +Z, camera looks from -Z.

const SIDEWALK_TOP := 0.12
const ROAD_HALF := 4.0
const WALK_EDGE := 8.0
## Skytrain viaduct: behind the shophouses (which end at z = 14), lifted to clear the roofs.
const RAIL_Z := 17.5
const RAIL_LIFT := 3.5

const WALL_COLORS := ["8f7068", "67565a", "4d6c55", "51444a", "7a6a55", "5a6a78", "6e5f52"]
const AWNING_COLORS := ["b5674d", "4f7a6a", "c9a65a", "6a5a8a", "8f5a5a"]
const WARM := ["ffcf8f", "ffd9a8", "f2b880"]
const SIGNS := {2: "ก๋วยเตี๋ยว", 4: "ร้านกาแฟ", 6: "เสื้อผ้า", 8: "ร้านเกม", 10: "ตัดผม"}
## Shophouses drawn from a ChatGPT facade texture instead of boxes: index -> [texture, sign].
const TEXTURED := {5: ["shophouse_a", "ร้านชำ"], 9: ["shophouse_a", ""]}


static func ground_height(p: Vector3) -> float:
	return SIDEWALK_TOP if absf(p.z) > ROAD_HALF else 0.0


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
	_ground(root)
	_road_markings(root)
	_shophouses(root, rng)
	_skytrain(root)
	_lamps(root)
	_south_side(root)
	_props(root)


static func _ground(root: Node3D) -> void:
	# Tiled, so the Mobile renderer's per-mesh light limit (8 omni) is never hit.
	var asphalt := Toon.mat(Color("2b3038"), 0.85)
	var walk := Toon.mat(Color("6b6a66"), 0.45)
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
	var z := -3.6
	while z <= 3.6:
		if absf(z) > 0.6:
			box(root, Vector3(0, 0.012, z), Vector3(3.2, 0.02, 0.45), paint)
		z += 0.9
	# Median divider with a gap at the crossing.
	var divider := Toon.mat(Color("7d7f80"))
	for side in [-1.0, 1.0]:
		box(root, Vector3(side * 16.5, 0.15, 0), Vector3(29, 0.3, 0.6), divider, true)


static func _shophouses(root: Node3D, rng: RandomNumberGenerator) -> void:
	var i := 0
	var x := -26.4
	while x <= 26.4:
		_shophouse(root, rng, x, i)
		x += 4.4
		i += 1


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
	if sign != "":
		# The facade's empty signboard band sits about a third of the way up.
		var l := Toon.label(sign, 72, Color(1.7, 1.4, 1.0), 0)
		l.pixel_size = 0.006
		l.position = Vector3(x, size.y * 0.334, front - 0.03)
		l.rotation.y = PI
		root.add_child(l)


static func _vending_machine(root: Node3D, pos: Vector3) -> void:
	var size := Toon.texture_size_m("vending_front")
	var depth := Toon.texture_size_m("vending_side").x
	var c := pos + Vector3(0, size.y / 2, 0)
	box(root, c, Vector3(size.x - 0.02, size.y - 0.02, depth - 0.02), Toon.mat(Color("3f6f6e")), true)
	face(root, c + Vector3(0, 0, -depth / 2), size, PI, Toon.textured("vending_front", 1.6))
	var side := Vector2(depth, size.y)
	face(root, c + Vector3(size.x / 2, 0, 0), side, PI / 2, Toon.textured("vending_side"))
	face(root, c + Vector3(-size.x / 2, 0, 0), side, -PI / 2, Toon.textured("vending_side"))
	omni(root, c + Vector3(0, 0.2, -depth / 2 - 0.5), Color("e8f4ff"), 0.6, 2.5)


static func _shophouse(root: Node3D, rng: RandomNumberGenerator, x: float, idx: int) -> void:
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
	var pole := Toon.mat(Color("3a3f45"))
	var toward := -signf(z)
	box(root, Vector3(x, SIDEWALK_TOP + 2.1, z), Vector3(0.14, 4.2, 0.14), pole, true)
	box(root, Vector3(x, 4.3, z + toward * 0.45), Vector3(0.1, 0.1, 0.9), pole)
	box(root, Vector3(x, 4.22, z + toward * 0.9), Vector3(0.38, 0.14, 0.26), Toon.glow(Color("ffd59a"), 4.0))
	var lamp := omni(root, Vector3(x, 3.9, z + toward * 0.9), Color("ffc983"), 2.6, 6.5)
	lamp.add_to_group("street_lamps")


static func _lamps(root: Node3D) -> void:
	for x in [-18.0, -6.0, 6.0, 18.0]:
		_lamp(root, x, 4.5)
	for x in [-24.0, -12.0, 0.0, 12.0, 24.0]:
		_lamp(root, x, -4.5)


static func _south_side(root: Node3D) -> void:
	var wall := Toon.mat(Color("5c5a58"))
	var ivy := Toon.mat(Color("3b5849"))
	box(root, Vector3(0, 0.3, -8.25), Vector3(64, 0.6, 0.3), wall, true)
	box(root, Vector3(0, 0.66, -8.25), Vector3(64, 0.14, 0.42), ivy)
	var trunk := Toon.mat(Color("51444a"))
	var leaf_a := Toon.occluder(Color("3b5849"), 0.03)
	var leaf_b := Toon.occluder(Color("4d6c55"), 0.03)
	for x in [-18.0, -6.0, 6.0, 18.0]:
		box(root, Vector3(x, 0.32, -7.3), Vector3(1.3, 0.4, 1.3), wall, true)
		box(root, Vector3(x, 1.2, -7.3), Vector3(0.22, 1.6, 0.22), trunk)
		sphere(root, Vector3(x, 2.3, -7.3), 1.0, leaf_a, Vector3(1, 0.85, 1))
		sphere(root, Vector3(x + 0.2, 3.0, -7.4), 0.65, leaf_b, Vector3(1, 0.9, 1))


static func _props(root: Node3D) -> void:
	# Vending machine against the shuttered house next to the textured shop (index 6 -> x = 0).
	_vending_machine(root, Vector3(1.3, SIDEWALK_TOP, WALK_EDGE - 0.4))

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
