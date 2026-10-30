class_name PropLayout
extends RefCounted
## Where the movable props stand: kind (a PropKit.CATALOG key), foot position
## and yaw. Saved as JSON by the in-game editor; when there is no file yet,
## the defaults placed by the city code are used.

const PATH := "res://data/layouts/siam_corner.json"
## Exported builds can't write into res://; fall back to the user folder.
const FALLBACK := "user://layouts/siam_corner.json"

var items: Array[Dictionary] = []


static func load_or(defaults: Array[Dictionary]) -> PropLayout:
	var layout := PropLayout.new()
	for path in [PATH, FALLBACK]:
		if not FileAccess.file_exists(path):
			continue
		var data = JSON.parse_string(FileAccess.get_file_as_string(path))
		if data is Array:
			for d in data:
				layout.items.append({
					"kind": String(d.kind),
					"pos": Vector3(d.pos[0], d.pos[1], d.pos[2]),
					"yaw": float(d.get("yaw", 0.0)),
				})
			return layout
	layout.items = defaults.duplicate(true)
	return layout


## Writes the layout and returns the path it went to.
func save() -> String:
	var out := []
	for it in items:
		var p: Vector3 = it.pos
		out.append({
			"kind": it.kind,
			"pos": [snappedf(p.x, 0.001), snappedf(p.y, 0.001), snappedf(p.z, 0.001)],
			"yaw": snappedf(it.yaw, 0.0001),
		})
	var text := JSON.stringify(out, "\t")
	for path in [PATH, FALLBACK]:
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir()))
		var f := FileAccess.open(path, FileAccess.WRITE)
		if f != null:
			f.store_string(text)
			return path
	return ""
