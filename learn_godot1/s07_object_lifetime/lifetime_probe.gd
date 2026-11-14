extends Node

const ManualProbe = preload("res://manual_object.gd")
const ReferenceProbe = preload("res://reference_probe.gd")

func _ready():
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	var manual = ManualProbe.new()
	manual.free()
	manual = null
	print("Manual Object freed")

	var first = ReferenceProbe.new()
	var second = first
	first = null
	print("First variable cleared; second still owns Reference")
	second = null
	print("Last Reference variable cleared")
	get_tree().quit()
