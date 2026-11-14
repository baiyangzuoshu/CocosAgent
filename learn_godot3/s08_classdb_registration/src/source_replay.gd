# S08 Godot 3.6: ClassDB maps registered native classes to creators and bound metadata.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var db = {}
	_register_class(db, "Object", "", false, false)
	_register_class(db, "Node", "Object", true, false)
	_register_class(db, "CanvasItem", "Node", false, true)
	_register_class(db, "Node2D", "CanvasItem", true, false)
	print("[replay S08] class_exists(Node2D)=", db.has("Node2D"))
	print("[replay S08] can_instance(CanvasItem)=", _can_instance(db, "CanvasItem"))
	var node = _instance(db, "Node2D", 6301)
	print("[replay S08] ClassDB.instance result=", node, " base chain=", _base_chain(db, "Node2D"))

# C++ 对照：ClassDB::register_class / GDREGISTER_CLASS
func _register_class(db, name, base, has_creator, abstract):
	db[name] = {"base": base, "creator": has_creator, "abstract": abstract}

# C++ 对照：ClassDB::can_instance
func _can_instance(db, name):
	return db.has(name) and db[name]["creator"] and not db[name]["abstract"]

# C++ 对照：ClassDB::instance / GDScriptNativeClass::instance
func _instance(db, name, instance_id):
	if not _can_instance(db, name):
		return null
	return {"class": name, "id": instance_id, "class_api": "ClassDB.instance"}

# C++ 对照：ClassDB::is_parent_class
func _base_chain(db, name):
	var chain = []
	var current = name
	while current != "" and db.has(current):
		chain.append(current)
		current = db[current]["base"]
	return chain
