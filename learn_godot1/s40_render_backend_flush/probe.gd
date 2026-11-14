extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 1 S40] 光栅化后端、命令刷新与一帧绘制")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var draw_script = preload("res://draw_probe.gd")
	var canvas = draw_script.new()
	add_child(canvas)
	print("Experiment: redraw runs the CanvasItem callback; the engine owns backend flush and present.")


