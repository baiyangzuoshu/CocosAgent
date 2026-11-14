extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 3 S38] 相机、视锥裁剪和可见对象收集")
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
	var camera = Camera.new()
	world.add_child(camera)
	camera.set_translation(Vector3(0, 0, 5))
	camera.make_current()
	print("Experiment: move the current camera and compare the mesh against the view volume.")

