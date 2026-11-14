extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 3 S32] 锚点、Container 布局和 Theme 属性")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var row = HBoxContainer.new()
	add_child(row)
	var first = Button.new()
	var second = Button.new()
	first.set_text("Minimum 120 x 32")
	second.set_text("Container child")
	first.set("rect_min_size", Vector2(120, 32))
	row.add_child(first)
	row.add_child(second)
	print("Experiment: resize the window and compare container-managed child positions.")

