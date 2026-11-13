extends Node

const ManualProbe = preload("res://manual_object.gd")
const ReferenceProbe = preload("res://reference_probe.gd")

func _ready() -> void:
	var manual = ManualProbe.new()
	manual.free()
	manual = null
	print("Manual Object freed")

	var first = ReferenceProbe.new()
	var second = first
	first = null
	print("First variable cleared; second still owns RefCounted")
	second = null
	print("Last RefCounted variable cleared")
	get_tree().quit()
