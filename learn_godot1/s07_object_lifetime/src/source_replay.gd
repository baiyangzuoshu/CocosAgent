# S07 Godot 1.1: ObjectDB tracks Object IDs; Reference deletes after last unref.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var db = {}
	var plain = _construct(db, 1001, "Object", 0)
	var shared = _construct(db, 1002, "Reference", 1)
	print("[replay S07] Object::get_instance_ID()=", plain, " database lookup=", _lookup(db, plain))
	_remove(db, plain)
	print("[replay S07] Object.free removes ID=", _lookup(db, plain) == null)
	_ref(db, shared)
	print("[replay S07] Reference duplicate owner count=", db[shared]["refs"])
	_unref(db, shared)
	print("[replay S07] one unref keeps instance=", _lookup(db, shared) != null)
	_unref(db, shared)
	print("[replay S07] last unref removes instance=", _lookup(db, shared) == null)

# C++ 对照：Object::Object / ObjectDB::add_instance
func _construct(db, instance_id, class_label, refs):
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
	if db[instance_id]["refs"] == 0:
		_remove(db, instance_id)
