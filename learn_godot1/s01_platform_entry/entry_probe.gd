extends Node

func _ready():
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	print("S01 reached: the main scene root entered READY.")
