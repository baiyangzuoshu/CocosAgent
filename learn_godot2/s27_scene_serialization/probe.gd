extends Node

func _ready():
	var scene = load("res://payload.tscn")
	print("dependency scene loaded: ", scene != null)
	print("root children: ", scene.instance().get_child_count() if scene != null else -1)
