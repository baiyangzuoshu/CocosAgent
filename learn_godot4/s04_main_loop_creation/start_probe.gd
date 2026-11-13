extends Node

func _ready() -> void:
	var active_scene: Node = get_tree().get_current_scene()
	print("S04 SceneTree current scene:")
	print(active_scene.name)
