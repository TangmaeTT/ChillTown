class_name PlayerLook
extends RefCounted
## The local player's chosen look, saved between sessions. Later the server
## will store it per account and send it to other players as a short string.

const PATH := "user://look.json"

var hair_style := "messy"
## alpha 0 = the hairstyle's drawn colour
var hair_tint := Color(0, 0, 0, 0)


static func load_saved() -> PlayerLook:
	var look := PlayerLook.new()
	if FileAccess.file_exists(PATH):
		var d = JSON.parse_string(FileAccess.get_file_as_string(PATH))
		if d is Dictionary:
			look.hair_style = String(d.get("hair_style", look.hair_style))
			var t = d.get("hair_tint", [])
			if t is Array and t.size() == 4:
				look.hair_tint = Color(t[0], t[1], t[2], t[3])
	return look


func save() -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({
			"hair_style": hair_style,
			"hair_tint": [hair_tint.r, hair_tint.g, hair_tint.b, hair_tint.a],
		}))
