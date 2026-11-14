# S04 Godot 2.1: Main::start loads a format-1 PackedScene and calls instance().
extends Reference

func run():
	var resource = _load_main_scene("res://main.tscn", true)
	var first = _packed_scene_instance(resource, 1)
	var second = _packed_scene_instance(resource, 2)
	var tree = {"root": "SceneTree root", "current_scene": null, "order": []}
	_install_current_scene(tree, first)
	print("[replay S04] project format=", resource["format"])
	print("[replay S04] packed path=", resource["path"], " independent instances=", first["id"] != second["id"])
	print("[replay S04] current_scene=", tree["current_scene"]["name"])
	print("[replay S04] enter/ready order=", tree["order"])

func _load_main_scene(path, found):
	if not found:
		return null
	return {"path": path, "format": "text scene format 1", "root": "CourseRoot", "child": "Probe"}

func _packed_scene_instance(resource, serial):
	if resource == null:
		return null
	return {"id": serial, "name": resource["root"], "child": resource["child"]}

func _install_current_scene(tree, scene):
	tree["current_scene"] = scene
	tree["order"].append("add scene beneath SceneTree root")
	tree["order"].append(scene["name"] + " ENTER_TREE")
	tree["order"].append(scene["child"] + " ENTER_TREE")
	tree["order"].append(scene["child"] + " READY")
	tree["order"].append(scene["name"] + " READY")
