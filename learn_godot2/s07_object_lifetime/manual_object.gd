extends Object

func _init():
	print("Manual Object ID: ", get_instance_ID())

func _notification(what):
	if what == NOTIFICATION_PREDELETE:
		print("Manual Object PREDELETE")
