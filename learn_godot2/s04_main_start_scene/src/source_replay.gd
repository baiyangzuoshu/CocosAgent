# S04 Godot 2.1: Main::start loads a format-1 PackedScene and calls instance().
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var resource = _load_main_scene("res://main.tscn", true)
	var first = _packed_scene_instance(resource, 1)
	var second = _packed_scene_instance(resource, 2)
	var tree = {"root": "SceneTree root", "current_scene": null, "order": []}
	var installed = _install_current_scene(tree, first)
	var missing = _load_main_scene("res://missing.tscn", false)
	var missing_tree = {"root": "SceneTree root", "current_scene": null, "order": []}
	var missing_installed = _install_current_scene(missing_tree, _packed_scene_instance(missing, 3))
	print("[replay S04] project format=", resource["format"])
	print("[replay S04] packed path=", resource["path"], " independent instances=", first["id"] != second["id"])
	print("[replay S04] installed=", installed, " current_scene=", tree["current_scene"]["name"])
	print("[replay S04] enter/ready order=", tree["order"])
	print("[replay S04] missing resource installs=", missing_installed, " current_scene remains null=", missing_tree["current_scene"] == null)

# C++ 对照：Main::start / ResourceLoader::load
func _load_main_scene(path, found):
	if not found:
		return null
	return {"path": path, "format": "text scene format 1", "root": "CourseRoot", "child": "Probe"}

# C++ 对照：PackedScene::instance
func _packed_scene_instance(resource, serial):
	if resource == null:
		return null
	return {"id": serial, "name": resource["root"], "child": resource["child"]}

# C++ 对照：SceneTree::add_current_scene / SceneTree::init
func _install_current_scene(tree, scene):
	if scene == null:
		return false
	tree["current_scene"] = scene
	tree["order"].append("add scene beneath SceneTree root")
	tree["order"].append(scene["name"] + " ENTER_TREE")
	tree["order"].append(scene["child"] + " ENTER_TREE")
	tree["order"].append(scene["child"] + " READY")
	tree["order"].append(scene["name"] + " READY")
	return true
