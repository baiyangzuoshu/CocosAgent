# S04 Godot 3.6: Main::start chooses SceneTree and instances format-2 PackedScene.
extends Reference

func run():
	var packed = _load_scene("res://main.tscn", true)
	var instance_a = _packed_scene_instance(packed, 1)
	var instance_b = _packed_scene_instance(packed, 2)
	var tree = {"root": "SceneTree root", "current_scene": null, "events": []}
	_install_scene(tree, instance_a)
	print("[replay S04] main_loop_type=SceneTree")
	print("[replay S04] format=", packed["format"], " instance API=PackedScene.instance()")
	print("[replay S04] same resource, separate nodes=", instance_a["id"] != instance_b["id"])
	print("[replay S04] current scene=", tree["current_scene"]["name"], " events=", tree["events"])

func _load_scene(path, found):
	if not found:
		return null
	return {"path": path, "format": "text scene format 2", "root": "CourseRoot", "children": ["Probe"]}

func _packed_scene_instance(packed, serial):
	if packed == null:
		return null
	return {"id": serial, "name": packed["root"], "children": packed["children"].duplicate()}

func _install_scene(tree, scene):
	tree["current_scene"] = scene
	tree["events"].append("SceneTree::set_current_scene")
	tree["events"].append("scene enters tree parent-first")
	tree["events"].append("READY is delivered child-first")
