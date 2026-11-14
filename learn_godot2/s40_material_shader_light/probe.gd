extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 2 S40] 材质、shader、灯光与绘制状态")
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
	var camera = Camera.new()
	world.add_child(camera)
	camera.set_translation(Vector3(0, 0, 5))
	camera.make_current()
	var material = FixedMaterial.new()
	material.set_parameter(FixedMaterial.PARAM_DIFFUSE, Color(1, 0.2, 0.2))
	mesh_node.set_material_override(material)
	var light = DirectionalLight.new()
	light.set_color(Light.COLOR_DIFFUSE, Color(1, 0.95, 0.8))
	world.add_child(light)
	print("Experiment: compare the resource parameter with the server-side material/light update path.")

