extends Node

func _ready():
	var parent = Node2D.new()
	var child = Node2D.new()
	add_child(parent)
	parent.add_child(child)
	parent.set_pos(Vector2(10, 20))
	child.set_pos(Vector2(3, 4))
	print("S19 local pos: ", child.get_pos())
	print("S19 global pos: ", child.get_global_pos())
	get_tree().quit()
