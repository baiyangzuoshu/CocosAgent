extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 1 S37] 3D 可见对象与渲染实例注册")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var world = Spatial.new()
	add_child(world)
	var mesh_node = MeshInstance.new()
	var mesh_resource = Mesh.new()
	var arrays = []
	arrays.resize(Mesh.ARRAY_MAX)
	var vertices = Vector3Array()
	vertices.push_back(Vector3(-1, -1, 0))
	vertices.push_back(Vector3(1, -1, 0))
	vertices.push_back(Vector3(0, 1, 0))
	arrays[Mesh.ARRAY_VERTEX] = vertices
	var normals = Vector3Array()
	normals.push_back(Vector3(0, 0, 1))
	normals.push_back(Vector3(0, 0, 1))
	normals.push_back(Vector3(0, 0, 1))
	arrays[Mesh.ARRAY_NORMAL] = normals
	mesh_resource.add_surface(Mesh.PRIMITIVE_TRIANGLES, arrays)
	mesh_node.set_mesh(mesh_resource)
	world.add_child(mesh_node)
	print("Experiment: the geometry node enters the scene tree; inspect its base RID and scenario registration in C++.")

