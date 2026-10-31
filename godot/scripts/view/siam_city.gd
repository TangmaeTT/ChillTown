class_name SiamCity
## The Siam block drawn from Codex textures (tools/city_batch.py -> tools/city_convert.py):
## a side road north from the junction at x = 0, the skytrain running along X south of the
## main road with its station in the lower-left of the screen, utility poles with cable
## bundles, and the street props.
## Every piece checks that its texture exists, so the scene still runs while art is missing.

const CROSS_HALF := 4.0         ## side road: x in [-4, 4], from the main road north
const CROSS_WALK := 2.5         ## its sidewalks
const CROSS_END := 40.0
const DECK_Y := 11.0            ## underside of the viaduct = top of the piers
const DECK_WIDTH := 7.2
const RAIL_Z := -32.0           ## along X, south of the main road (shows below the south sidewalk)
const RAIL_HALF_LEN := 90.0
const TRACKS := [-1.8, 1.8]     ## z of the two tracks, from RAIL_Z
const STATION_X := 14.0         ## +X is up-left on screen: with the rail this far south, lower left
const WEST_END := -37.4
const EAST_END := 37.4
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
	for ix in range(-9, 9):
		for iz in range(-7, 10):
			CityBuilder.box(root, Vector3(ix * 10 + 5, -0.1, iz * 10 + 5), Vector3(10, 0.2, 10), asphalt)
	var top := CityBuilder.SIDEWALK_TOP
	# Main sidewalks, cut where the side road meets the north one.
	var road := CityBuilder.ROAD_HALF
	var north := CityBuilder.WALK_EDGE - road
	var south := -CityBuilder.SOUTH_EDGE - road
	for seg in [[WEST_END, -CROSS_HALF - CROSS_WALK], [CROSS_HALF + CROSS_WALK, EAST_END]]:
		var w: float = seg[1] - seg[0]
		CityBuilder.box(root, Vector3((seg[0] + seg[1]) / 2, top / 2, road + north / 2), Vector3(w, top, north), walk)
	CityBuilder.box(root, Vector3((WEST_END + EAST_END) / 2, top / 2, -road - south / 2), Vector3(EAST_END - WEST_END, top, south), walk)
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
		CityBuilder.box(root, Vector3(x, 3.75, front - 0.08), Vector3(minf(3.0, front_m.x - 1.0), 0.7, 0.1), Toon.mat(Color("2a2f38")))
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


## The line runs along X like the main road, far enough south (z = RAIL_Z) that from this
## camera it shows below the south sidewalk instead of over the street (a thing h metres up
## looks like ground about 1.2 h further toward +X and +Z). On screen +X runs up-left and
## +Z up-right, so the station at x = STATION_X is the lower-left corner. The station
## building stands on the road side of the tracks and the camera sees the trains' -Z side
## at the platform in front of it; stairs come down to the south sidewalk. It is scenery:
## no cutaway, it never fades around the player.
static func skytrain(root: Node3D) -> void:
	if not has("city_viaduct_side"):
		return
	var seg := Toon.texture_size_m("city_viaduct_side")          # (length, girder depth)
	var x := -RAIL_HALF_LEN
	while x < RAIL_HALF_LEN:
		var cx := x + seg.x / 2
		for sz in [-1.0, 1.0]:
			CityBuilder.face(root, Vector3(cx, DECK_Y + seg.y / 2, RAIL_Z + sz * DECK_WIDTH / 2), seg,
					PI if sz < 0 else 0.0, Toon.textured("city_viaduct_side"))
		if has("city_viaduct_top"):
			flat(root, Vector3(cx, DECK_Y + seg.y + 0.01, RAIL_Z), Vector2(seg.x, DECK_WIDTH), "city_viaduct_top")
		x += seg.x
	if has("city_pier_front"):
		# The T cap spans the deck (Z), so the camera sees the pier's profile: yaw 90.
		for px in [-56.0, -36.0, -16.0, 4.0, 24.0, 44.0, 64.0]:
			PropKit.textured_box(root, "city_pier", Vector3(px, 0, RAIL_Z), PI / 2)
	if has("city_station_front"):
		var depth := Toon.texture_size_m("city_station_side").x
		var sz := RAIL_Z + DECK_WIDTH / 2 + depth / 2
		PropKit.textured_box(root, "city_station", Vector3(STATION_X, DECK_Y - 1.0, sz), 0.0)
		CityBuilder.omni(root, Vector3(STATION_X, DECK_Y + 4.0, RAIL_Z), Color("e8f0ff"), 1.5, 14.0)
		if has("city_station_stairs_front"):
			# From the station's road side down to the south sidewalk, near its +X end
			# (left on screen), away from the clock at the junction.
			var run := Toon.texture_size_m("city_station_stairs_side").x
			# Turned round (yaw 180): the climb starts at the other end.
			var st_len := Toon.texture_size_m("city_station_front").x
			var sw := Toon.texture_size_m("city_station_stairs_front").x
			PropKit.textured_box(root, "city_station_stairs",
					Vector3(STATION_X + st_len / 2 + sw / 2 + 0.5, 0.0, CityBuilder.SOUTH_EDGE - 0.6 - run / 2), PI)
	if PropKit.has_voxel("city_train_head") and PropKit.has_voxel("city_train_mid"):
		for i in TRACKS.size():
			var t := Node3D.new()
			t.set_script(preload("res://scripts/view/train_runner.gd"))
			t.set("direction", -1.0 if i == 0 else 1.0)
			t.set("delay", 0.0 if i == 0 else 25.0)
			t.position = Vector3(0, DECK_Y + seg.y, RAIL_Z + TRACKS[i])
			root.add_child(t)
			_train_cars(t)


## Three voxel cars along local X. The models' long side faces -Z (toward the camera) and
## the cab is at local -X; the last car is mirrored to put its cab at the +X end.
static func _train_cars(t: Node3D) -> void:
	var length := Toon.texture_size_m("city_train_head_side").x
	var gap := 0.6
	var names := ["city_train_head", "city_train_mid", "city_train_head"]
	for i in 3:
		var car := PropKit.voxel(t, names[i], Vector3((i - 1) * (length + gap), 0, 0))
		if i == 2:
			car.scale.x = -1.0


# --- utilities --------------------------------------------------------------

## Concrete poles along the north sidewalk with sagging cable bundles between them.
static func utilities(root: Node3D) -> void:
	if not has("city_utility_pole_front"):
		return
	var z := CityBuilder.ROAD_HALF + 0.5
	var xs := [-35.0, -27.0, -19.0, -11.0, 11.0, 19.0, 27.0, 35.0]
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

## A car parked along the main road, nose toward -X (yaw 0: the camera sees its side and
## nose) or +X (yaw PI).
static func vehicle(root: Node3D, name: String, pos: Vector3, yaw := 0.0) -> void:
	if not has(name + "_side"):
		return
	if PropKit.has_voxel(name):
		PropKit.voxel(root, name, pos, yaw)
		var sz := Toon.texture_size_m(name + "_side")
		CityBuilder.solid(root, pos + Vector3(0, sz.y / 2, 0), Vector3(sz.x, sz.y, 1.8))
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
	var back := CityBuilder.SOUTH_EDGE + 0.9
	for x in [-30.0, -18.0, -6.0, 6.0, 18.0, 30.0]:
		CityBuilder.add_default("planter_tree", Vector3(x, t, back))
	CityBuilder.add_default("rain_tree", Vector3(-36.0, t, back - 0.2))
	# Shop signs out on the pavement, roadworks at the far east end.
	var front := CityBuilder.WALK_EDGE
	for spot in [["sign_aframe", -17.0], ["sign_aframe", 17.0], ["sign_aframe", -30.0],
			["sign_lightbox", 12.6], ["sign_lightbox", 22.0], ["sign_lightbox", -31.8]]:
		CityBuilder.add_default(spot[0], Vector3(spot[1], t, front - 0.7))
	CityBuilder.add_default("barrier_water", Vector3(33.0, 0.0, -3.2))
	CityBuilder.add_default("cone", Vector3(30.8, 0.0, -3.0))
	CityBuilder.add_default("cone", Vector3(29.6, 0.0, -2.6))
	CityBuilder.add_default("crowd_barrier", Vector3(35.0, t, -5.0))
	CityBuilder.add_default("table_stools", Vector3(18.6, t, front - 1.6))
	CityBuilder.add_default("trash_bins", Vector3(15.2, t, front - 0.5))


# --- street marks -----------------------------------------------------------

## Paint and ironwork on the ground (fixed, not layout props): stop lines before the
## crossings, lane arrows, manholes in the road and drain grates along the curbs.
static func street_marks(root: Node3D) -> void:
	if not has("city_road_marks_3"):
		return
	var road := CityBuilder.ROAD_HALF
	# Stop lines across the inner lanes, a car length before each crossing.
	flat(root, Vector3(-CROSS_HALF - 5.2, 0.012, -road / 2), Vector2(0.3, road - 0.2), "city_road_marks_3")
	flat(root, Vector3(CROSS_HALF + 1.2, 0.012, road / 2), Vector2(0.3, road - 0.2), "city_road_marks_3")
	# Straight-ahead arrows in the traffic lanes, pointing the way each lane runs.
	for spot in [[-16.0, -1.1, -1.0], [16.0, -1.1, -1.0], [-16.0, 1.1, 1.0], [16.0, 1.1, 1.0]]:
		var a := flat(root, Vector3(spot[0], 0.012, spot[1]), Vector2(2.6, 1.1), "city_road_marks_4")
		a.rotate_y(PI if spot[2] > 0 else 0.0)
	# Manholes in the road, grates and covers along the kerbs and on the pavement.
	for spot in [[-24.0, -0.4, 0], [9.5, 0.6, 0], [26.0, -1.6, 0], [-10.0, 3.7, 1], [4.0, -3.7, 1],
			[-30.0, 3.7, 1], [20.0, -3.7, 1], [-14.0, 6.0, 2], [24.0, -6.2, 2]]:
		var tex := "city_street_decals_%d" % spot[2]
		var y := 0.012 if absf(spot[1]) < road else CityBuilder.SIDEWALK_TOP + 0.006
		var size := Toon.texture_size_m(tex)
		flat(root, Vector3(spot[0], y, spot[1]), size, tex)


# --- life ---------------------------------------------------------------------

const TRAFFIC := ["city_taxi_pink", "city_taxi_green", "city_sedan_white", "city_tuktuk",
		"city_pickup", "city_taxi_pink", "city_city_bus", "city_sedan_white", "city_taxi_green"]


## Two lanes of cars on the main road, westbound on the south side (noses to -X, the way
## the models face) and eastbound on the north. Parked cars use the curb lanes.
static func traffic(root: Node3D) -> void:
	var kinds := TRAFFIC.filter(func(n: String) -> bool: return PropKit.has_voxel(n))
	if kinds.is_empty():
		return
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	for lane in [[-1.1, -1.0, 7.5], [1.1, 1.0, 6.5]]:
		var node := Node3D.new()
		node.set_script(preload("res://scripts/view/traffic_lane.gd"))
		node.set("direction", lane[1])
		node.set("speed", lane[2])
		node.position.z = lane[0]
		root.add_child(node)
		var x := -60.0
		var k := rng.randi() % kinds.size()
		while x < 60.0:
			var name: String = kinds[k % kinds.size()]
			k += 1
			var half := Toon.texture_size_m(name + "_side").x / 2
			var car := PropKit.voxel(node, name, Vector3(x + half, 0, 0), 0.0 if lane[1] < 0 else PI)
			car.set_meta("half", half)
			x += half * 2 + rng.randf_range(9.0, 22.0)


## Passers-by on both sidewalks and up the side road, in the outfits and hairstyles the
## player can pick, plus a couple standing at the stalls.
static func pedestrians(root: Node3D) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	var outfits := SpriteChibi.OUTFITS.keys()
	var hairs := SpriteChibi.HAIR_STYLES.keys()
	var tints := [Color(0, 0, 0, 0), Color("3d2c26"), Color("8a5a3c"), Color("1e1e24"), Color("c9a27a"), Color("7a4a8a")]
	var walk := CityBuilder.WALK_EDGE
	var south := CityBuilder.SOUTH_EDGE
	# [x0, x1, z, along_z]
	var routes := [
		[-36.0, -7.0, walk - 2.4, false], [-36.0, -7.0, walk - 1.6, false], [7.0, 36.0, walk - 2.4, false],
		[7.0, 36.0, walk - 1.6, false], [-34.0, 34.0, south + 1.7, false], [-34.0, 34.0, south + 1.7, false],
		[-20.0, 20.0, -4.8, false], [5.0, 30.0, CROSS_HALF + CROSS_WALK / 2, true],
	]
	for r in routes:
		var p := Node3D.new()
		p.set_script(preload("res://scripts/view/pedestrian.gd"))
		p.set("x0", r[0])
		p.set("x1", r[1])
		p.set("along_z", r[3])
		p.set("speed", rng.randf_range(0.8, 1.4))
		p.set("look", {"outfit": outfits[rng.randi() % outfits.size()],
				"hair_style": hairs[rng.randi() % hairs.size()], "hair_tint": tints[rng.randi() % tints.size()]})
		var along := rng.randf_range(r[0], r[1])
		p.position = Vector3(r[2], 0, along) if r[3] else Vector3(along, 0, r[2])
		root.add_child(p)
	# Customers at the noodle cart and the fruit cart (standing, facing the stall).
	for spot in [[Vector3(-17.0, 0, 5.4), Vector3(0, 0, 1)], [Vector3(15.4, 0, 5.4), Vector3(0, 0, 1)]]:
		var c := SpriteChibi.new({"outfit": outfits[rng.randi() % outfits.size()],
				"hair_style": hairs[rng.randi() % hairs.size()], "hair_tint": tints[rng.randi() % tints.size()]})
		c.position = spot[0] + Vector3(0, CityBuilder.SIDEWALK_TOP, 0)
		root.add_child(c)
		c.set_motion(0.0, spot[1])
