extends Node

func _ready():
	var active_scene = get_tree().get_current_scene()
	print("S04 SceneTree current scene:")
	print(active_scene.name)
