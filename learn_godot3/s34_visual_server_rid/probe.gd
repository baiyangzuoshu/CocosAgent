extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 3 S34] VisualServer、RID 与场景层抽象")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var rid = VisualServer.canvas_item_create()
	print("created VisualServer canvas RID=", rid)
	VisualServer.free_rid(rid)
	print("Experiment: the script calls the public interface; inspect which backend implementation receives it.")

