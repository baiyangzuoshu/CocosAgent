extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 3 S33] Window、Viewport 与屏幕坐标关系")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	print("canvas transform=", get_viewport().get_canvas_transform())
	set_process_input(true)
	print("Experiment: click the window, then compare InputEvent coordinates after changing stretch.")

func _input(event):
	print("[input event] ", event)

