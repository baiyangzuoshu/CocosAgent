extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 4 S37] 3D 场景对象如何进入渲染服务器")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var world = Node3D.new()
	add_child(world)
	var mesh_node = MeshInstance3D.new()
	var mesh_resource = BoxMesh.new()
	mesh_node.mesh = mesh_resource
	world.add_child(mesh_node)
	print("Experiment: the geometry node enters the scene tree; inspect its base RID and scenario registration in C++.")

