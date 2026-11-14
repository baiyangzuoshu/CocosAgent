# S08 Godot 1.1: ObjectTypeDB keeps parent metadata and optional creator function.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var types = {}
	_register_type(types, "Object", "", true)
	_register_type(types, "Node", "Object", true)
	_register_type(types, "CanvasItem", "Node", false)
	_register_type(types, "Node2D", "CanvasItem", true)
	print("[replay S08] Node2D type record=", types["Node2D"])
	print("[replay S08] CanvasItem has creator=", _can_create(types, "CanvasItem"))
	print("[replay S08] Node2D instance=", _instance(types, "Node2D", 5001))
	print("[replay S08] is Node2D an Object=", _inherits(types, "Node2D", "Object"))

# C++ 对照：ObjectTypeDB::_add_type2 / register_type
func _register_type(types, name, base, has_creator):
	types[name] = {"base": base, "creator": has_creator}

# C++ 对照：ObjectTypeDB::can_instance
func _can_create(types, name):
	return types.has(name) and types[name]["creator"]

# C++ 对照：ObjectTypeDB::instance / GDNativeClass::instance
func _instance(types, name, instance_id):
	if not _can_create(types, name):
		return null
	return {"class": name, "id": instance_id}

# C++ 对照：TypeInfo::inherits_ptr
func _inherits(types, name, base):
	var current = name
	while current != "":
		if current == base:
			return true
		if not types.has(current):
			return false
		current = types[current]["base"]
	return false
