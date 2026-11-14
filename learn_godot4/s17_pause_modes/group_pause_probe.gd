extends Node

func _ready() -> void:
	add_to_group("lesson_targets")
	get_tree().call_group("lesson_targets", "_on_group_call")
	process_mode = Node.PROCESS_MODE_ALWAYS
	get_tree().paused = true
	print("S17 tree paused: ", get_tree().paused)
	get_tree().paused = false
	get_tree().quit()

func _on_group_call() -> void:
	print("S17 group call received")
