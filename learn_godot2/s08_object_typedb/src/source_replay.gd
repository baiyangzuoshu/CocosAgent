# S08 Godot 2.1: ObjectTypeDB::register_type stores a base link and factory.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var db = {}
	_register_type(db, "Object", "", true)
	_register_type(db, "Node", "Object", true)
	_register_type(db, "CanvasItem", "Node", false)
	_register_type(db, "Node2D", "CanvasItem", true)
	print("[replay S08] registered Node2D=", db.has("Node2D"))
	print("[replay S08] ObjectTypeDB.can_instance(CanvasItem)=", _can_instance(db, "CanvasItem"))
	print("[replay S08] ObjectTypeDB.instance(Node2D)=", _instance(db, "Node2D", 5201))
	print("[replay S08] parent chain=", _parent_chain(db, "Node2D"))

# C++ 对照：ObjectTypeDB::_add_type2 / register_type
func _register_type(db, name, base, factory):
	db[name] = {"base": base, "factory": factory}

# C++ 对照：ObjectTypeDB::can_instance
func _can_instance(db, name):
	return db.has(name) and db[name]["factory"]

# C++ 对照：ObjectTypeDB::instance / GDNativeClass::instance
func _instance(db, name, new_id):
	if not _can_instance(db, name):
		return null
	return {"class": name, "instance_ID": new_id}

# C++ 对照：TypeInfo::inherits_ptr
func _parent_chain(db, name):
	var chain = []
	var current = name
	while current != "" and db.has(current):
		chain.append(current)
		current = db[current]["base"]
	return chain
