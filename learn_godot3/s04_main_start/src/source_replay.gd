# S04 Godot 3.6: Main::start chooses SceneTree and instances format-2 PackedScene.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var packed = _load_scene("res://main.tscn", true)
	var instance_a = _packed_scene_instance(packed, 1)
	var instance_b = _packed_scene_instance(packed, 2)
	var tree = {"root": "SceneTree root", "current_scene": null, "events": []}
	var installed = _install_scene(tree, instance_a)
	var missing = _load_scene("res://missing.tscn", false)
	var missing_tree = {"root": "SceneTree root", "current_scene": null, "events": []}
	var missing_installed = _install_scene(missing_tree, _packed_scene_instance(missing, 3))
	print("[replay S04] main_loop_type=SceneTree")
	print("[replay S04] format=", packed["format"], " instance API=PackedScene.instance()")
	print("[replay S04] same resource, separate nodes=", instance_a["id"] != instance_b["id"])
	print("[replay S04] installed=", installed, " current scene=", tree["current_scene"]["name"], " events=", tree["events"])
	print("[replay S04] missing resource installs=", missing_installed, " current_scene remains null=", missing_tree["current_scene"] == null)

# C++ 对照：Main::start / ResourceLoader::load
func _load_scene(path, found):
	if not found:
		return null
	return {"path": path, "format": "text scene format 2", "root": "CourseRoot", "children": ["Probe"]}

# C++ 对照：PackedScene::instance
func _packed_scene_instance(packed, serial):
	if packed == null:
		return null
	return {"id": serial, "name": packed["root"], "children": packed["children"].duplicate()}

# C++ 对照：SceneTree::set_current_scene / SceneTree::init
func _install_scene(tree, scene):
	if scene == null:
		return false
	tree["current_scene"] = scene
	tree["events"].append("SceneTree::set_current_scene")
	tree["events"].append("scene enters tree parent-first")
	tree["events"].append("READY is delivered child-first")
	return true
