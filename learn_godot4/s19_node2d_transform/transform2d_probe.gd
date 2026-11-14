extends Node

func _ready():
	var parent = Node2D.new()
	var child = Node2D.new()
	add_child(parent)
	parent.add_child(child)
	parent.position = Vector2(10, 20)
	child.position = Vector2(3, 4)
	print("S19 local position: ", child.position)
	print("S19 global position: ", child.global_position)
	get_tree().quit()
