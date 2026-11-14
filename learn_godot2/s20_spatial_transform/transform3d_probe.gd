extends Node

func _ready():
	var parent = Spatial.new()
	var child = Spatial.new()
	add_child(parent)
	parent.add_child(child)
	parent.set_translation(Vector3(3, 0, 0))
	child.set_translation(Vector3(2, 0, 0))
	print("S20 local translation: ", child.get_translation())
	print("S20 global origin: ", child.get_global_transform().origin)
	get_tree().quit()
