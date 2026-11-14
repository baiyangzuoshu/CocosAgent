extends Node

func _ready():
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	var args = OS.get_cmdline_args()
	print("S02 engine arguments:")
	for arg in args:
		print(arg)
