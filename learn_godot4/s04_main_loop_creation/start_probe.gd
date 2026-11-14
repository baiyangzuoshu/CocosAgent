extends Node

func _ready() -> void:
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	var active_scene: Node = get_tree().get_current_scene()
	print("S04 SceneTree current scene:")
	print(active_scene.name)
