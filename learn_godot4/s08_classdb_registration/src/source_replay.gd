# S08 Godot 4.7: ClassDB::instantiate uses registered creation info and abstract flags.
extends RefCounted

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var db = {}
	_register_class(db, "Object", "", true, false)
	_register_class(db, "Node", "Object", true, false)
	_register_class(db, "CanvasItem", "Node", false, true)
	_register_class(db, "Node2D", "CanvasItem", true, false)
	print("[replay S08] class_exists(Node2D)=", db.has("Node2D"))
	print("[replay S08] abstract CanvasItem can instantiate=", _can_instantiate(db, "CanvasItem"))
	var node = _instantiate(db, "Node2D", 4701)
	print("[replay S08] ClassDB.instantiate(Node2D)=", node)
	print("[replay S08] inheritance=", _is_class(db, "Node2D", "CanvasItem"), ", ", _is_class(db, "Node2D", "Node"))

# C++ 对照：ClassDB::register_class / GDREGISTER_CLASS
func _register_class(db, name, base, has_creation_info, abstract):
	db[name] = {"base": base, "creation_info": has_creation_info, "abstract": abstract}

# C++ 对照：ClassDB::can_instantiate
func _can_instantiate(db, name):
	return db.has(name) and db[name]["creation_info"] and not db[name]["abstract"]

# C++ 对照：ClassDB::instantiate
func _instantiate(db, name, instance_id):
	if not _can_instantiate(db, name):
		return null
	return {"class": name, "id": instance_id, "factory": "ClassDB::instantiate"}

# C++ 对照：ClassDB::is_parent_class / Object::is_class
func _is_class(db, name, base):
	var current = name
	while current != "" and db.has(current):
		if current == base:
			return true
		current = db[current]["base"]
	return false
