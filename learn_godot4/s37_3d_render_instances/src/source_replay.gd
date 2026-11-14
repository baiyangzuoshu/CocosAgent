extends RefCounted

# VisualInstance3D::_notification → RenderingServer instance base/scenario/transform
var state = {}

func run_model():
	print("[S37 replay Godot 4] 3D 场景对象如何进入渲染服务器")
	state = {"inside_tree": false, "instance": 0, "base": "", "scenario": "", "transform": Vector3(0, 0, 0)}
	_instance_enter_tree()
	_set_base("CubeMesh")
	_set_transform(Vector3(1, 2, 3))
	_set_scenario("main")
	print("[instance] ", state)

func _instance_enter_tree():
	state["inside_tree"] = true
	state["instance"] = 101
	print("[instance create] RID=", state["instance"])

func _set_base(mesh_name):
	state["base"] = mesh_name
	print("[instance base] ", mesh_name)

func _set_transform(origin):
	state["transform"] = origin
	print("[instance transform] origin=", origin)

func _set_scenario(name):
	state["scenario"] = name
	print("[scenario] ", name)
