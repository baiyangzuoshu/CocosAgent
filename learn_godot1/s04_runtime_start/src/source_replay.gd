# S04 Godot 1.1: XML PackedScene::instance() is a new node tree, not the resource.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var packed = _load_main_scene("res://main.xml", true)
	var instance_a = _instance_packed_scene(packed, 1)
	var instance_b = _instance_packed_scene(packed, 2)
	var tree = {"root": null, "current_scene": null, "order": []}
	var installed = _install_scene_tree(tree, instance_a)
	var missing = _load_main_scene("res://missing.xml", false)
	var missing_tree = {"root": null, "current_scene": null, "order": []}
	var missing_installed = _install_scene_tree(missing_tree, _instance_packed_scene(missing, 3))
	print("[replay S04] format=", packed["format"], " resource=", packed["path"])
	print("[replay S04] two instance IDs differ=", instance_a["id"] != instance_b["id"])
	print("[replay S04] installed=", installed, " notifications=", tree["order"])
	print("[replay S04] current scene=", tree["current_scene"]["name"])
	print("[replay S04] missing resource installs=", missing_installed, " tree unchanged=", missing_tree["current_scene"] == null)

# C++ 对照：Main::start / ResourceLoader::load
func _load_main_scene(path, found):
	if not found:
		return null
	return {"path": path, "format": "XML PackedScene", "root": "CourseRoot", "children": ["Probe"]}

# C++ 对照：PackedScene::instance
func _instance_packed_scene(resource, serial):
	if resource == null:
		return null
	return {"id": serial, "name": resource["root"], "children": resource["children"].duplicate()}

# C++ 对照：SceneTree::add_current_scene / SceneTree::init
func _install_scene_tree(tree, scene):
	if scene == null:
		return false
	tree["root"] = {"name": "root"}
	tree["current_scene"] = scene
	tree["order"].append("SceneTree::init installs root")
	tree["order"].append(scene["name"] + " ENTER_TREE")
	for child in scene["children"]:
		tree["order"].append(child + " ENTER_TREE")
	for child in scene["children"]:
		tree["order"].append(child + " READY")
	tree["order"].append(scene["name"] + " READY")
	return true
