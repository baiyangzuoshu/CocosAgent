extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 4 S39] Mesh、Material 与 Shader 的绘制准备")
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
	camera.make_current()
	var material = StandardMaterial3D.new()
	material.albedo_color = Color(1, 0.2, 0.2)
	mesh_node.material_override = material
	print("Experiment: compare the resource parameter with the server-side material/light update path.")

