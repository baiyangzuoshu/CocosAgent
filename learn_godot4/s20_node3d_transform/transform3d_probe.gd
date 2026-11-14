extends Node

func _ready() -> void:
	var parent := Node3D.new()
	var child := Node3D.new()
	add_child(parent)
	parent.add_child(child)
	parent.position = Vector3(3, 0, 0)
	child.position = Vector3(2, 0, 0)
	print("S20 local position: ", child.position)
	print("S20 global position: ", child.global_position)
	get_tree().quit()
