extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 2 S37] 2D Canvas、相机和画布变换")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var draw_script = preload("res://draw_probe.gd")
	var canvas = draw_script.new()
	add_child(canvas)
	print("canvas transform=", get_viewport().get_canvas_transform())
	print("Experiment: change command order and compare overlapping canvas items.")


