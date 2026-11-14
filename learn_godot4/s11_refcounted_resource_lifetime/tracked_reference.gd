extends RefCounted

func _init():
	print("S11 RefCounted created")

func _notification(what):
	if what == NOTIFICATION_PREDELETE:
		print("S11 RefCounted PREDELETE")
