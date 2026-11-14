extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 2 S33] 锚点、容器、尺寸约束与主题")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var row = HBoxContainer.new()
	row.set_pos(Vector2(24, 32))
	row.set_size(Vector2(520, 64))
	add_child(row)
	var first = Button.new()
	var second = Button.new()
	first.set_text("Minimum 120 x 32")
	second.set_text("Container child")
	first.set_custom_minimum_size(Vector2(120, 32))
	row.add_child(first)
	row.add_child(second)
	print("Experiment: edit the HBoxContainer size and compare its allocated child rectangles.")

