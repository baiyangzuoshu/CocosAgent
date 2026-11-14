# S07 Godot 2.1: ObjectDB lifetime is explicit for Object, refcount-driven for Reference.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var db = {}
	var object_id = _register(db, 2101, "Object", 0)
	var ref_id = _register(db, 2102, "Reference", 1)
	print("[replay S07] ID lookup after construction=", _lookup(db, object_id)["class"])
	_remove(db, object_id)
	print("[replay S07] Object.free lookup=", _lookup(db, object_id))
	_ref(db, ref_id)
	print("[replay S07] Reference copied; refs=", db[ref_id]["refs"])
	_unref(db, ref_id)
	print("[replay S07] first unref still alive=", _lookup(db, ref_id) != null)
	_unref(db, ref_id)
	print("[replay S07] final unref deleted=", _lookup(db, ref_id) == null)

# C++ 对照：Object::Object / ObjectDB::add_instance
func _register(db, instance_id, class_label, refs):
	db[instance_id] = {"class": class_label, "refs": refs}
	return instance_id

# C++ 对照：ObjectDB::get_instance
func _lookup(db, instance_id):
	return db.get(instance_id, null)

# C++ 对照：Object::~Object / ObjectDB::remove_instance
func _remove(db, instance_id):
	db.erase(instance_id)

# C++ 对照：Reference::reference
func _ref(db, instance_id):
	db[instance_id]["refs"] += 1

# C++ 对照：Reference::unreference
func _unref(db, instance_id):
	db[instance_id]["refs"] -= 1
	if db[instance_id]["refs"] <= 0:
		_remove(db, instance_id)
