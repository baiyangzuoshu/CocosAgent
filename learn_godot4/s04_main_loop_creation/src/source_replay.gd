# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends RefCounted

# Main::start model: load scene resource → instance root → attach it to main loop → READY.
func run():
	var path = "res://main.tscn"
	var packed_scene = {"path": path, "root": "Main"}
	print("[replay S04] ResourceLoader.load(", path, ")")
	var root = _instance_scene(packed_scene)
	print("[replay S04] MainLoop installs root: ", root["name"])
	root["inside_tree"] = true
	print("[replay S04] SceneTree.initialize → enter tree → READY")

func _instance_scene(packed_scene):
	return {"name": packed_scene["root"], "source": packed_scene["path"], "inside_tree": false}
