extends RefCounted

func _init() -> void:
	print("RefCounted ID: ", get_instance_id())

func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE:
		print("RefCounted PREDELETE")
