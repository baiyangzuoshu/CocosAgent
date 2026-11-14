# S04 Godot 1.1: XML PackedScene::instance() is a new node tree, not the resource.
extends Reference

func run():
	var packed = _load_main_scene("res://main.xml", true)
	var instance_a = _instance_packed_scene(packed, 1)
	var instance_b = _instance_packed_scene(packed, 2)
	var tree = {"root": null, "current_scene": null, "order": []}
	_install_scene_tree(tree, instance_a)
	print("[replay S04] format=", packed["format"], " resource=", packed["path"])
	print("[replay S04] two instance IDs differ=", instance_a["id"] != instance_b["id"])
	print("[replay S04] notifications=", tree["order"])
	print("[replay S04] current scene=", tree["current_scene"]["name"])

func _load_main_scene(path, found):
	if not found:
		return null
	return {"path": path, "format": "XML PackedScene", "root": "CourseRoot", "children": ["Probe"]}

func _instance_packed_scene(resource, serial):
	if resource == null:
		return null
	return {"id": serial, "name": resource["root"], "children": resource["children"].duplicate()}

func _install_scene_tree(tree, scene):
	tree["root"] = {"name": "root"}
	tree["current_scene"] = scene
	tree["order"].append("SceneTree::init installs root")
	tree["order"].append(scene["name"] + " ENTER_TREE")
	for child in scene["children"]:
		tree["order"].append(child + " ENTER_TREE")
	for child in scene["children"]:
		tree["order"].append(child + " READY")
	tree["order"].append(scene["name"] + " READY")
