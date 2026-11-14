extends Node

func _ready():
	var parent = Spatial.new()
	var child = Spatial.new()
	add_child(parent)
	parent.add_child(child)
	parent.translation = Vector3(3, 0, 0)
	child.translation = Vector3(2, 0, 0)
	print("S20 local translation: ", child.translation)
	print("S20 global translation: ", child.global_translation)
	get_tree().quit()
