class_name ChatLog
extends RefCounted
## Chat messages in the current room. No engine nodes: the view listens to
## message_added, the controller calls post(). The server will own this later.

signal message_added(sender: String, text: String)

const MAX_LENGTH := 120
const KEEP := 50

var messages: Array[Dictionary] = []


func post(sender: String, text: String) -> void:
	var clean := text.strip_edges()
	if clean.is_empty():
		return
	clean = clean.left(MAX_LENGTH)
	messages.append({"sender": sender, "text": clean})
	if messages.size() > KEEP:
		messages.pop_front()
	message_added.emit(sender, clean)
