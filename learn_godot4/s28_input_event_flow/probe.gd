extends Node

func _ready():
	set_process_input(true)
	print("press a key to inspect InputEventKey")

func _input(event):
	if event is InputEventKey:
		print("keycode=", event.keycode, " physical=", event.physical_keycode, " pressed=", event.pressed)
	else:
		print("event class=", event.get_class(), " text=", event.as_text())
