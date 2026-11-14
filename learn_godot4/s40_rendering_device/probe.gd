extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 4 S40] RenderingDevice 与图形后端提交")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var draw_script = preload("res://draw_probe.gd")
	var canvas = draw_script.new()
	add_child(canvas)
	print("Experiment: redraw runs the CanvasItem callback; the engine owns backend flush and present.")


