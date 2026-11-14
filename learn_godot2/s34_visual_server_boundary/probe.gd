extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 2 S34] 场景节点到 VisualServer 的职责边界")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var rid = VisualServer.canvas_item_create()
	print("created VisualServer canvas RID=", rid)
	VisualServer.free(rid)
	print("Experiment: the script calls the public interface; inspect which backend implementation receives it.")

