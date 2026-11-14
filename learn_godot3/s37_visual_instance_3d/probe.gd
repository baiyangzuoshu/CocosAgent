extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 3 S37] 3D 场景对象到 VisualServer 实例")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var world = Spatial.new()
	add_child(world)
	var mesh_node = MeshInstance.new()
	var mesh_resource = CubeMesh.new()
	mesh_node.set_mesh(mesh_resource)
	world.add_child(mesh_node)
	print("Experiment: the geometry node enters the scene tree; inspect its base RID and scenario registration in C++.")

