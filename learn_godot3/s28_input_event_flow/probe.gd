extends Node

func _ready():
	set_process_input(true)
	print("press a key to inspect InputEventKey")

func _input(event):
	if event is InputEventKey:
		print("scancode=", event.scancode, " pressed=", event.pressed, " echo=", event.echo)
	else:
		print("event class=", event.get_class(), " text=", event.as_text())
