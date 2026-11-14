extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 3 S39] Mesh、Material、Shader 与渲染状态")
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
	var material = SpatialMaterial.new()
	material.albedo_color = Color(1, 0.2, 0.2)
	mesh_node.set_material_override(material)
	print("Experiment: compare the resource parameter with the server-side material/light update path.")

