extends Node

func _ready():
	print("S08 Node2D registered: ", ClassDB.class_exists("Node2D"))
	print("S08 Node2D can_instance: ", ClassDB.can_instance("Node2D"))
	var probe = ClassDB.instance("Node2D")
	print("S08 dynamic class: ", probe.get_class())
	print("S08 inherits CanvasItem: ", probe.is_class("CanvasItem"))
	print("S08 inherits Node: ", probe.is_class("Node"))
	probe.set_position(Vector2(12, 24))
	print("S08 bound position property: ", probe.position)
	probe.free()
	get_tree().quit()
