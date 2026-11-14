extends Node

func _ready():
	add_to_group("lesson_targets")
	get_tree().call_group("lesson_targets", "_on_group_call")
	pause_mode = PAUSE_MODE_PROCESS
	get_tree().paused = true
	print("S17 tree paused: ", get_tree().paused)
	get_tree().paused = false
	get_tree().quit()

func _on_group_call():
	print("S17 group call received")
