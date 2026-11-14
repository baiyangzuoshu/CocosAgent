extends MainLoop

func init():
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	print("S00 source snapshot: Godot 1.1 stable")
	print("S00 runtime platform: " + OS.get_name())
	print("Runtime version: check the Godot 1.1 tool banner or Project Manager")

func iteration(delta):
	return true
