extends Node

func _ready():
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	print("S03 VisualServer INFO_OBJECTS_IN_FRAME:")
	print(VisualServer.get_render_info(VisualServer.INFO_OBJECTS_IN_FRAME))
