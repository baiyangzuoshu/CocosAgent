# S07 Godot 3.6: ObjectDB/ObjectID registration and Reference::unreference deletion.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var db = {}
	var object_id = _register(db, 3601, "Object", 0)
	var reference_id = _register(db, 3602, "Reference", 1)
	print("[replay S07] ObjectID resolves=", _lookup(db, object_id) != null)
	_predelete(db, object_id)
	print("[replay S07] NOTIFICATION_PREDELETE sent before erase=", db[object_id]["predelete"])
	_remove(db, object_id)
	_ref(db, reference_id)
	_unref(db, reference_id)
	print("[replay S07] Reference after non-final unref=", _lookup(db, reference_id) != null)
	_unref(db, reference_id)
	print("[replay S07] Reference after final unref=", _lookup(db, reference_id))

# C++ 对照：Object::Object / ObjectDB::add_instance
func _register(db, instance_id, class_label, refs):
	db[instance_id] = {"class": class_label, "refs": refs, "predelete": false}
	return instance_id

# C++ 对照：ObjectDB::get_instance
func _lookup(db, instance_id):
	return db.get(instance_id, null)

# C++ 对照：Object::_predelete / NOTIFICATION_PREDELETE
func _predelete(db, instance_id):
	db[instance_id]["predelete"] = true

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
