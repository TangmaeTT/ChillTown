class_name SiamCity
## The Siam block drawn from Codex textures (tools/city_batch.py -> tools/city_convert.py):
## a side road north from the junction at x = 0, the skytrain crossing the main road at the
## west end with its station to the south, utility poles with cable bundles, and the
## street props.
## Every piece checks that its texture exists, so the scene still runs while art is missing.

const CROSS_HALF := 4.0         ## side road: x in [-4, 4], from the main road north
const CROSS_WALK := 2.5         ## its sidewalks
const CROSS_END := 40.0
const DECK_Y := 11.0            ## underside of the viaduct = top of the piers
const DECK_WIDTH := 7.2
const RAIL_X := 12.0            ## south of the main road: the lower-left corner of the screen
const RAIL_Z_FROM := -110.0
const RAIL_Z_TO := -23.0        ## the line ends at the station
const TRACKS := [-1.8, 1.8]     ## x of the two tracks, from RAIL_X
const STATION_Z := -45.0        ## far enough south to sit in the screen's lower-left corner
const WEST_END := -30.0
const EAST_END := 30.0
const TRAIN_SPEED := 11.0


static func has(name: String) -> bool:
	return Toon.has_texture(name)


## Is p on the side road (road level, not sidewalk)?
static func on_cross_road(p: Vector3) -> bool:
	return absf(p.x) < CROSS_HALF and p.z > CityBuilder.ROAD_HALF


## A flat face lying on the ground plane or up in the air; `size` is (along X, along Z).
## Codex draws top views either way round, so the texture is turned to put its long side
## along the face's long side.
static func flat(parent: Node3D, center: Vector3, size: Vector2, tex: String, down := false, cut := false) -> MeshInstance3D:
	var t := Toon.texture_size_m(tex)
	var turn := (t.x > t.y) != (size.x > size.y)
	var mi := CityBuilder.face(parent, center, Vector2(size.y, size.x) if turn else size, 0.0, Toon.textured(tex, 2.0, cut))
	var b := Basis(Vector3.RIGHT, PI / 2 if down else -PI / 2)
	if turn:
		b = Basis(Vector3.UP, PI / 2) * b
	mi.basis = b
	return mi


# --- ground ---------------------------------------------------------------

static func ground(root: Node3D) -> void:
	var asphalt := Toon.ground("city_asphalt", Color.WHITE, 0.85)
	var walk := Toon.ground("city_pavers", Color.WHITE, 0.45)
	var cross_walk := Toon.ground("city_pavers", Color.WHITE, 0.45, 2.0, true)
	for ix in range(-3, 5):
		for iz in range(-12, 10):
			CityBuilder.box(root, Vector3(ix * 10 + 5, -0.1, iz * 10 + 5), Vector3(10, 0.2, 10), asphalt)
	var top := CityBuilder.SIDEWALK_TOP
	# Main sidewalks, cut where the side road meets the north one.
	for seg in [[WEST_END, -CROSS_HALF - CROSS_WALK], [CROSS_HALF + CROSS_WALK, EAST_END]]:
		var w: float = seg[1] - seg[0]
		CityBuilder.box(root, Vector3((seg[0] + seg[1]) / 2, top / 2, 6.0), Vector3(w, top, 4), walk)
	CityBuilder.box(root, Vector3((WEST_END + EAST_END) / 2, top / 2, -6.0), Vector3(EAST_END - WEST_END, top, 4), walk)
	# Side road sidewalks, from the main road's north edge to the far end.
	for sx in [-1.0, 1.0]:
		var x: float = sx * (CROSS_HALF + CROSS_WALK / 2)
		var z0 := CityBuilder.ROAD_HALF
		CityBuilder.box(root, Vector3(x, top / 2, (z0 + CROSS_END) / 2), Vector3(CROSS_WALK, top, CROSS_END - z0), cross_walk)
	curbs(root)
	crossings(root)


## Black-and-white curbs: the side (facing the road) and top of every 2 m block.
static func curbs(root: Node3D) -> void:
	if not has("city_curb_side"):
		return
	var y := CityBuilder.SIDEWALK_TOP
	var x := WEST_END
	while x < EAST_END:
		var cx := x + 1.0
		if absf(cx) > CROSS_HALF + CROSS_WALK:
			_curb_block(root, Vector3(cx, y, CityBuilder.ROAD_HALF), PI)        # north curb faces -Z
		_curb_block(root, Vector3(cx, y, -CityBuilder.ROAD_HALF), 0.0)         # south curb faces +Z
		x += 2.0
	var z := CityBuilder.ROAD_HALF + 2.5
	while z < CROSS_END:
		_curb_block(root, Vector3(-CROSS_HALF, y, z + 1.0), PI / 2)            # west curb faces +X
		_curb_block(root, Vector3(CROSS_HALF, y, z + 1.0), -PI / 2)            # east curb faces -X
		z += 2.0


static func _curb_block(root: Node3D, edge: Vector3, yaw: float) -> void:
	var n := Basis(Vector3.UP, yaw) * Vector3(0, 0, 1)
	var side := CityBuilder.face(root, edge + Vector3(0, -edge.y / 2, 0) + n * 0.01,
			Vector2(2.0, edge.y), yaw, Toon.textured("city_curb_side"))
	side.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var t := CityBuilder.face(root, edge + Vector3(0, 0.005, 0) - n * 0.12, Vector2(2.0, 0.25), yaw, Toon.textured("city_curb_top"))
	t.rotate_object_local(Vector3.RIGHT, -PI / 2)


## Zebra crossings: across the main road west of the junction, and across the side road.
static func crossings(root: Node3D) -> void:
	if not has("city_crosswalk"):
		return
	var across_main := Toon.ground("city_crosswalk", Color.WHITE, 0.6, 2.0, true)
	var across_side := Toon.ground("city_crosswalk", Color.WHITE, 0.6, 2.0)
	CityBuilder.box(root, Vector3(-CROSS_HALF - 3.2, 0.006, 0), Vector3(3.0, 0.02, CityBuilder.ROAD_HALF * 2), across_main)
	CityBuilder.box(root, Vector3(0, 0.006, CityBuilder.ROAD_HALF + 1.6), Vector3(CROSS_HALF * 2, 0.02, 3.0), across_side)


# --- buildings --------------------------------------------------------------

## A building from a front/side/roof texture set, front on the sidewalk edge at `x`.
## No interior kit: the shopfront hole looks into a shallow lit room.
static func building(root: Node3D, x: float, tex: String, sign: String, nudge: float) -> void:
	var front_m := Toon.texture_size_m(tex + "_front")
	var depth := Toon.texture_size_m(tex + "_side").x
	var h := front_m.y
	var front := CityBuilder.WALK_EDGE
	var c := Vector3(x, h / 2, front + depth / 2)
	CityBuilder.solid(root, c, Vector3(front_m.x - 0.1, h, depth))
	# Body behind the facade, set back so the shopfront opening is a real recess.
	var body := Toon.mat(Color("5e5550"))
	CityBuilder.box(root, Vector3(x, h / 2, front + 1.5 + (depth - 1.5) / 2), Vector3(front_m.x - 0.06, h - 0.02, depth - 1.5), body)
	var room := Toon.mat(Color("8a7a66"))
	CityBuilder.box(root, Vector3(x, 3.4, front + 0.75), Vector3(front_m.x - 0.06, 0.1, 1.5), room)    # ceiling
	CityBuilder.box(root, Vector3(x, CityBuilder.SIDEWALK_TOP, front + 0.75), Vector3(front_m.x - 0.06, 0.02, 1.5), room)
	for sx in [-1.0, 1.0]:
		CityBuilder.box(root, Vector3(x + sx * (front_m.x / 2 - 0.05), 1.7, front + 0.75), Vector3(0.06, 3.4, 1.5), room)
	CityBuilder.omni(root, Vector3(x, 2.4, front + 0.8), Color("ffc58a"), 1.2, 3.5)
	CityBuilder.face(root, Vector3(x, h / 2, front - 0.01 - nudge), front_m, PI, Toon.textured(tex + "_front"))
	CityBuilder.face(root, Vector3(x - front_m.x / 2 - 0.01, h / 2, c.z), Vector2(depth, h), -PI / 2, Toon.textured(tex + "_side"))
	var roof := CityBuilder.face(root, Vector3(x, h + 0.01, c.z), Vector2(front_m.x, depth), 0.0, Toon.textured(tex + "_roof"))
	roof.rotation.x = -PI / 2
	CityBuilder.reflection(root, Vector3(x, 0, front - 0.3), 2.4, 2.0, Color("ffbf80"), 0.3)
	if sign != "":
		CityBuilder.box(root, Vector3(x, 3.75, front - 0.08), Vector3(3.0, 0.7, 0.1), Toon.mat(Color("2a2f38")))
		var l := Toon.label(sign, 72, Color(1.7, 1.4, 1.0), 0)
		l.pixel_size = 0.006
		l.position = Vector3(x, 3.75, front - 0.15)
		l.rotation.y = PI
		root.add_child(l)


# --- skytrain ---------------------------------------------------------------

## Lets the player show through a structure overhead (dithered circle, see toon shader).
static func cut_away(node: Node3D) -> void:
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		var m := (mi as MeshInstance3D).material_override as ShaderMaterial
		if m != null:
			m = m.duplicate()
			m.set_shader_parameter("cutaway", true)
			(mi as MeshInstance3D).material_override = m


## The line comes in from the south (along Z) and ends at a terminus station just behind
## the south sidewalk. On screen +X runs up-left and +Z up-right, so this is the lower-left
## corner: a set piece that never covers the street. The camera sees each car's whole -X
## side; trains run in, stop, and run back out. Stairs come down the station's west side
## to the south sidewalk.
static func skytrain(root: Node3D) -> void:
	if not has("city_viaduct_side"):
		return
	var seg := Toon.texture_size_m("city_viaduct_side")          # (length, girder depth)
	var z := RAIL_Z_FROM
	while z < RAIL_Z_TO:
		var cz := z + seg.x / 2
		for sx in [-1.0, 1.0]:
			CityBuilder.face(root, Vector3(RAIL_X + sx * DECK_WIDTH / 2, DECK_Y + seg.y / 2, cz), seg,
					sx * PI / 2, Toon.textured("city_viaduct_side", 2.0, true))
		if has("city_viaduct_top"):
			flat(root, Vector3(RAIL_X, DECK_Y + seg.y + 0.01, cz), Vector2(DECK_WIDTH, seg.x), "city_viaduct_top", false, true)
		z += seg.x
	if has("city_pier_front"):
		# The T cap spans the deck (X); the camera sees it from -Z.
		for pz in [-100.0, -82.0, -64.0, -46.0, -28.0]:
			cut_away(PropKit.textured_box(root, "city_pier", Vector3(RAIL_X, 0, pz)))
	if has("city_station_front"):
		# Long face toward -X (yaw +90 turns the model's front from -Z to -X).
		var depth := Toon.texture_size_m("city_station_side").x
		cut_away(PropKit.textured_box(root, "city_station", Vector3(RAIL_X, DECK_Y - 1.0, STATION_Z), PI / 2))
		CityBuilder.omni(root, Vector3(RAIL_X - depth / 2 - 1.0, DECK_Y - 1.5, STATION_Z), Color("e8f0ff"), 1.5, 14.0)
		if has("city_station_stairs_front"):
			# Behind the south wall, running east from the station and down toward the street.
			var run := Toon.texture_size_m("city_station_stairs_side").x
			var sw := Toon.texture_size_m("city_station_stairs_front").x
			cut_away(PropKit.textured_box(root, "city_station_stairs",
					Vector3(RAIL_X - depth / 2 - sw / 2, 0.0, -8.6 - run / 2)))
	if PropKit.has_voxel("city_train_head") and PropKit.has_voxel("city_train_mid"):
		for i in TRACKS.size():
			var t := Node3D.new()
			t.set_script(preload("res://scripts/view/train_runner.gd"))
			t.set("direction", 1.0)
			t.set("delay", 0.0 if i == 0 else 25.0)
			t.position = Vector3(RAIL_X + TRACKS[i], DECK_Y + seg.y, 0)
			root.add_child(t)
			_train_cars(t)


## Three voxel cars along local Z. The models' long side faces their local -Z and the
## cab is at local -X, so yaw +90 shows the side to the camera (-X) with the cab at +Z;
## the first car is mirrored to put its cab at the -Z end, toward the camera.
static func _train_cars(t: Node3D) -> void:
	var length := Toon.texture_size_m("city_train_head_side").x
	var gap := 0.6
	var names := ["city_train_head", "city_train_mid", "city_train_head"]
	for i in 3:
		var car := PropKit.voxel(t, names[i], Vector3(0, 0, (i - 1) * (length + gap)), PI / 2)
		if i == 0:
			car.scale.x = -1.0
		cut_away(car)


# --- utilities --------------------------------------------------------------

## Concrete poles along the north sidewalk with sagging cable bundles between them.
static func utilities(root: Node3D) -> void:
	if not has("city_utility_pole_front"):
		return
	var z := CityBuilder.ROAD_HALF + 0.5
	var xs := [-27.0, -19.0, -11.0, 11.0, 19.0, 27.0]
	for x in xs:
		PropKit.textured_box(root, "city_utility_pole", Vector3(x, CityBuilder.SIDEWALK_TOP, z))
	if not has("city_wire_bundle"):
		return
	var bundle := Toon.texture_size_m("city_wire_bundle")
	for i in xs.size() - 1:
		var a: float = xs[i]
		var b: float = xs[i + 1]
		if b - a > 12.0:
			continue
		var x := a
		while x < b - 0.1:
			var w := minf(bundle.x, b - x)
			var q := CityBuilder.face(root, Vector3(x + w / 2, 7.4, z), Vector2(w, bundle.y * w / bundle.x), PI, Toon.textured("city_wire_bundle"))
			q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
			x += w


static func lamp(root: Node3D, x: float, z: float) -> bool:
	if not has("city_street_lamp_front"):
		return false
	var node := PropKit.textured_box(root, "city_street_lamp", Vector3(x, CityBuilder.SIDEWALK_TOP, z), 0.0 if z < 0 else PI)
	var h := Toon.texture_size_m("city_street_lamp_front").y
	var toward := -signf(z)
	var l := CityBuilder.omni(root, Vector3(x, h - 0.6, z + toward * 1.2), Color("ffc983"), 2.6, 7.0)
	l.add_to_group("street_lamps")
	CityBuilder.reflection(root, Vector3(x, 0, z + toward * 1.2), h - 0.4, 0.5, Color("ffc983"), 0.9)
	return node != null


# --- vehicles ----------------------------------------------------------------

## A car parked along the main road, nose toward -X (the camera sees its side and nose).
static func vehicle(root: Node3D, name: String, pos: Vector3) -> void:
	if not has(name + "_side"):
		return
	if PropKit.has_voxel(name):
		var v := PropKit.voxel(root, name, pos)
		var sz := Toon.texture_size_m(name + "_side")
		CityBuilder.solid(root, pos + Vector3(0, sz.y / 2, 0), Vector3(sz.x, sz.y, 1.8))
		v = v
		return
	var side := Toon.texture_size_m(name + "_side")
	var w := Toon.texture_size_m(name + "_front").x if has(name + "_front") else 1.8
	CityBuilder.solid(root, pos + Vector3(0, side.y / 2, 0), Vector3(side.x, side.y, w))
	for sz in [-1.0, 1.0]:
		CityBuilder.face(root, pos + Vector3(0, side.y / 2, sz * w / 2), side, PI if sz < 0 else 0.0, Toon.textured(name + "_side", 2.5))
	if has(name + "_front"):
		var f := Toon.texture_size_m(name + "_front")
		CityBuilder.face(root, pos + Vector3(-side.x / 2 - 0.01, f.y / 2, 0), f, -PI / 2, Toon.textured(name + "_front", 2.5))
	if has(name + "_roof"):
		var r := Toon.texture_size_m(name + "_roof")
		flat(root, pos + Vector3(0, side.y + 0.01, 0), Vector2(side.x, w), name + "_roof")
		r = r


# --- props --------------------------------------------------------------------

## Default spots for the Codex street props (movable in the layout editor).
static func default_props() -> void:
	var t := CityBuilder.SIDEWALK_TOP
	var spots := [
		["spirit_house", Vector3(-11.4, t, 7.2), 0.0],
		["noodle_cart", Vector3(-17.6, t, 6.6), 0.0],
		["table_stools", Vector3(-15.4, t, 5.6), 0.0],
		["fruit_cart", Vector3(14.6, t, 6.5), 0.0],
		["grill_cart", Vector3(21.5, t, 6.5), 0.0],
		["moto_stand", Vector3(25.0, t, 5.0), 0.0],
		["lottery_stand", Vector3(-23.5, t, -6.4), 0.0],
		["kiosk_drinks", Vector3(-12.0, t, -6.6), 0.0],
		["police_box", Vector3(-8.0, t, -6.4), 0.0],
		["trash_bins", Vector3(-4.6, t, -5.0), 0.0],
		["clock_post", Vector3(0.0, t, -6.0), 0.0],
		["bench", Vector3(3.2, t, -6.8), 0.0],
		["kiosk_flowers", Vector3(12.0, t, -6.6), 0.0],
		["bus_stop", Vector3(22.0, t, -6.4), 0.0],
		["phone_booth", Vector3(-27.0, t, -5.2), 0.0],
	]
	for s in spots:
		CityBuilder.add_default(s[0], s[1], s[2])
	for x in [-18.0, -6.0, 6.0, 18.0]:
		CityBuilder.add_default("planter_tree", Vector3(x, t, -7.3))
	CityBuilder.add_default("rain_tree", Vector3(-28.0, t, -7.6))
