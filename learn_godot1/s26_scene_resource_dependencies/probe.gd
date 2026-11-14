extends Node

func _ready():
	var packed = ResourceLoader.load_interactive("res://payload.xml")
	print("interactive loader: ", packed)
	if packed != null:
		print("stages: ", packed.get_stage_count())
		print("resource after load: ", packed.wait(), ", ", packed.get_resource())
