extends Node

func _ready():
	print("inherited root: ", name)
	print("base child count: ", get_child_count())
	for child in get_children():
		print("inherited/local child: ", child.name)
