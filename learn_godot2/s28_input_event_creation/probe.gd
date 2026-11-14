extends Node

func _ready():
	set_process_input(true)
	print("press a key to inspect legacy InputEvent fields")

func _input(event):
	if event.type == InputEvent.KEY:
		print("key scancode=", event.scancode, " pressed=", event.pressed, " echo=", event.echo)
	else:
		print("event type=", event.type)
