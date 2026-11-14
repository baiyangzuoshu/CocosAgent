extends Reference

func _init():
	print("S11 Reference created")

func _notification(what):
	if what == NOTIFICATION_PREDELETE:
		print("S11 Reference PREDELETE")
