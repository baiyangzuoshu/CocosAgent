extends Node

func _ready():
	set_process_input(true)
	set_process_unhandled_input(true)
	print("Space should reach both stages; Escape is marked handled in _input")

func _input(event):
	print("[input] ", event)
	if event is InputEventKey and event.keycode == KEY_ESCAPE and event.pressed:
		get_tree().set_input_as_handled()
		print("[handled in _input]")

func _unhandled_input(event):
	print("[unhandled] ", event)
