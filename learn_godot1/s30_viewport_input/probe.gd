extends Node

func _ready():
	set_process_input(true)
	print("click inside the game window to inspect local mouse coordinates")

func _input(event):
	if event.type == InputEvent.MOUSE_BUTTON:
		print("viewport-local mouse: ", event.mouse_button.x, ", ", event.mouse_button.y)
