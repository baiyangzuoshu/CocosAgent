extends Node

const Tracked = preload("res://tracked_reference.gd")

func _ready():
	var first = Tracked.new()
	var second = first
	print("S11 aliases created")
	first = null
	print("S11 one alias cleared; second alive: ", second != null)
	second = null
	print("S11 last script alias cleared")
	get_tree().quit()
