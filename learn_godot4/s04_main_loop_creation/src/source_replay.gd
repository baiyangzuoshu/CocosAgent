# S04 Godot 4.7: Main::start loads a format-3 PackedScene and calls instantiate().
extends RefCounted

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var packed = _load_main_scene("res://main.tscn", true)
	var a = _instantiate(packed, 1)
	var b = _instantiate(packed, 2)
	var tree = {"root": "SceneTree root", "current_scene": null, "events": []}
	var installed = _set_current_scene(tree, a)
	var missing = _load_main_scene("res://missing.tscn", false)
	var missing_tree = {"root": "SceneTree root", "current_scene": null, "events": []}
	var missing_installed = _set_current_scene(missing_tree, _instantiate(missing, 3))
	print("[replay S04] main_loop_type=SceneTree; scene format=", packed["format"])
	print("[replay S04] PackedScene resource remains shared; node instances differ=", a["id"] != b["id"])
	print("[replay S04] installed=", installed, " current_scene=", tree["current_scene"]["name"], " events=", tree["events"])
	print("[replay S04] missing resource installs=", missing_installed, " current_scene remains null=", missing_tree["current_scene"] == null)

# C++ 对照：Main::start / ResourceLoader::load
func _load_main_scene(path, found):
	if not found:
		return null
	return {"path": path, "format": "text scene format 3", "root": "CourseRoot", "children": ["Probe"]}

# C++ 对照：PackedScene::instantiate
func _instantiate(packed, serial):
	if packed == null:
		return null
	return {"id": serial, "name": packed["root"], "children": packed["children"].duplicate()}

# C++ 对照：SceneTree::set_current_scene / SceneTree::initialize
func _set_current_scene(tree, scene):
	if scene == null:
		return false
	tree["current_scene"] = scene
	tree["events"].append("SceneTree root exists before project scene")
	tree["events"].append("set_current_scene adds the instantiated Node")
	tree["events"].append("enter_tree parent-first; ready child-first")
	return true
