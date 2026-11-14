extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 4 S34] RenderingServer、RID 与场景层接口")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var rid = RenderingServer.canvas_item_create()
	print("created RenderingServer canvas RID=", rid)
	RenderingServer.free_rid(rid)
	print("Experiment: the script calls the public interface; inspect which backend implementation receives it.")

