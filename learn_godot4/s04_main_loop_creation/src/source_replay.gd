# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends RefCounted

# C++ focus: Main::start() → ResourceLoader → PackedScene::instantiate() → SceneTree root/current scene.
func run():
	var path = "res://main.tscn"
	var missing = _resource_load(path, false)
	print("[replay S04] missing resource stops before instance=", missing == null)
	var packed = _resource_load(path, true)
	var first = _packed_scene_instance(packed, 1)
	var second = _packed_scene_instance(packed, 2)
	var tree = {"root": null, "current_scene": null, "notifications": []}
	_install_main_loop(tree, first)
	print("[replay S04] format=", packed["format"], " instance API=instantiate()")
	print("[replay S04] resource id=", packed["resource_id"])
	print("[replay S04] instances are separate=", first["instance_id"] != second["instance_id"])
	print("[replay S04] enter/ready order=", tree["notifications"])
	print("[replay S04] current scene=", tree["current_scene"]["name"])

func _resource_load(path, found):
	if not found:
		return null
	return {"resource_id": "PackedScene:" + path, "path": path, "format": "PackedScene format 3", "root_name": "CourseRoot", "children": ["Probe"]}

func _packed_scene_instance(packed, serial):
	var children = []
	for child_name in packed["children"]:
		children.append({"name": child_name, "inside_tree": false, "ready": false})
	return {"instance_id": "NodeInstance:" + str(serial), "name": packed["root_name"], "inside_tree": false, "ready": false, "children": children}

func _install_main_loop(tree, root):
	tree["root"] = root
	tree["notifications"].append("MainLoop::initialize")
	_set_current_scene(tree, root)

func _set_current_scene(tree, root):
	tree["current_scene"] = root
	root["inside_tree"] = true
	tree["notifications"].append(root["name"] + " ENTER_TREE")
	for child in root["children"]:
		child["inside_tree"] = true
		tree["notifications"].append(child["name"] + " ENTER_TREE")
	for child in root["children"]:
		child["ready"] = true
		tree["notifications"].append(child["name"] + " READY")
	root["ready"] = true
	tree["notifications"].append(root["name"] + " READY")
