# S04 Godot 4.7: Main::start loads a format-3 PackedScene and calls instantiate().
extends RefCounted

func run():
	var packed = _load_main_scene("res://main.tscn", true)
	var a = _instantiate(packed, 1)
	var b = _instantiate(packed, 2)
	var tree = {"root": "SceneTree root", "current_scene": null, "events": []}
	_set_current_scene(tree, a)
	print("[replay S04] main_loop_type=SceneTree; scene format=", packed["format"])
	print("[replay S04] PackedScene resource remains shared; node instances differ=", a["id"] != b["id"])
	print("[replay S04] current_scene=", tree["current_scene"]["name"], " events=", tree["events"])

func _load_main_scene(path, found):
	if not found:
		return null
	return {"path": path, "format": "text scene format 3", "root": "CourseRoot", "children": ["Probe"]}

func _instantiate(packed, serial):
	if packed == null:
		return null
	return {"id": serial, "name": packed["root"], "children": packed["children"].duplicate()}

func _set_current_scene(tree, scene):
	tree["current_scene"] = scene
	tree["events"].append("SceneTree root exists before project scene")
	tree["events"].append("set_current_scene adds the instantiated Node")
	tree["events"].append("enter_tree parent-first; ready child-first")
