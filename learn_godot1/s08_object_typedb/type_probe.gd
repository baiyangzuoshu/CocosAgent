extends Node

func _ready():
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	var probe = Node2D.new()
	print("S08 native type: ", probe.get_type())
	print("S08 inherits CanvasItem: ", probe.is_type("CanvasItem"))
	print("S08 inherits Node: ", probe.is_type("Node"))
	probe.free()
	get_tree().quit()
