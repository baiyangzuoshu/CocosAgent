extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 4 S38] Camera、视锥裁剪与可见对象列表")
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
	var camera = Camera3D.new()
	world.add_child(camera)
	camera.position = Vector3(0, 0, 5)
	camera.fov = 70.0
	camera.near = 0.1
	camera.far = 100.0
	camera.make_current()
	print("Experiment: edit camera position/FOV or near/far, rerun, and compare mesh visibility.")

