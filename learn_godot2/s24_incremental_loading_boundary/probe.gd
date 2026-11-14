extends Node

func _ready():
	var loader = ResourceLoader.load_interactive("res://payload.tscn")
	if loader == null:
		print("loader unavailable")
		return
	var started = OS.get_ticks_msec()
	var err = loader.wait()
	print("wait returned: ", err, " stage: ", loader.get_stage(), "/", loader.get_stage_count())
	print("elapsed ms: ", OS.get_ticks_msec() - started)
	print("resource: ", loader.get_resource())
