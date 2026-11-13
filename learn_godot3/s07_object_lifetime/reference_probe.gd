extends Reference

func _init():
	print("Reference ID: ", get_instance_id())

func _notification(what):
	if what == NOTIFICATION_PREDELETE:
		print("Reference PREDELETE")
