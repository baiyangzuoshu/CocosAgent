extends Node

func _ready() -> void:
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	print("S02 engine arguments: ", OS.get_cmdline_args())
	print("S02 user arguments: ", OS.get_cmdline_user_args())
