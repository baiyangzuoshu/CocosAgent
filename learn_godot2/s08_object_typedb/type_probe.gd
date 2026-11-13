extends Node

func _ready():
	print("S08 Node2D registered: ", type_exists("Node2D"))
	var probe = Node2D.new()
	print("S08 native type: ", probe.get_type())
	print("S08 inherits CanvasItem: ", probe.is_type("CanvasItem"))
	print("S08 inherits Node: ", probe.is_type("Node"))
	probe.free()
	get_tree().quit()
