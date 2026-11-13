extends Object

func _init() -> void:
	print("Manual Object ID: ", get_instance_id())

func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE:
		print("Manual Object PREDELETE")
