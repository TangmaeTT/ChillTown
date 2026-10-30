extends Node
## Dev-only: `godot --path . -- --shot=out.png [--shot-frames=N]` saves one
## frame of the running game and quits, so changes can be checked from the
## command line.

var _path := ""
var _frames := 90


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="):
			_path = a.substr(7)
		elif a.begins_with("--shot-frames="):
			_frames = int(a.substr(14))
	set_process(_path != "")


func _process(_delta: float) -> void:
	_frames -= 1
	if _frames > 0:
		return
	var img := get_viewport().get_texture().get_image()
	img.save_png(_path)
	print("DevShot saved ", _path)
	get_tree().quit()
