class_name GameClock
extends RefCounted
## In-game time of day. No nodes; SkyRig reads `hours` to light the world.
## The server will own the clock later so every player sees the same time.

## Game hours that pass per real second (1/60 = one game hour per real minute).
var hours_per_second := 1.0 / 60.0
var day := 1
## 0.0 .. 24.0
var hours := 21.0


func advance(delta: float) -> void:
	hours += delta * hours_per_second
	while hours >= 24.0:
		hours -= 24.0
		day += 1


func skip(h: float) -> void:
	advance(h / hours_per_second)


func is_night() -> bool:
	return hours >= 18.5 or hours < 6.0


func label() -> String:
	var m := int(hours * 60.0)
	return "วันที่ %d · %02d:%02d" % [day, m / 60, m % 60]
