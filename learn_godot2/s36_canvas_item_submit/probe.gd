extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 2 S36] CanvasItem 的绘制命令与画布提交")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var draw_script = preload("res://draw_probe.gd")
	var canvas = draw_script.new()
	add_child(canvas)
	print("Experiment: draw_probe.gd records draw_rect commands only from _draw().")


