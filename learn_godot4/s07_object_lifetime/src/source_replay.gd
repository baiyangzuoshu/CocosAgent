# S07 Godot 4.7: ObjectID slots/validators track objects; RefCounted controls ownership.
extends RefCounted

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var slots = {}
	var next_slot = 17
	var object_id = _allocate(slots, next_slot, "Object", false, 701)
	var resource_id = _allocate(slots, next_slot + 1, "RefCounted", true, 702)
	print("[replay S07] ObjectID=", object_id, " valid=", _resolve(slots, object_id) != null)
	_free_object(slots, object_id)
	print("[replay S07] Object.free invalidates slot=", _resolve(slots, object_id) == null)
	var replacement_id = _allocate(slots, next_slot, "Node", false, 703)
	print("[replay S07] reused slot resolves replacement=", _resolve(slots, replacement_id) != null, " rejects stale ObjectID=", _resolve(slots, object_id) == null)
	_ref(slots, resource_id)
	_unref(slots, resource_id)
	print("[replay S07] RefCounted with one owner still resolves=", _resolve(slots, resource_id) != null)
	_unref(slots, resource_id)
	print("[replay S07] zero owners releases slot=", _resolve(slots, resource_id) == null)

# C++ 对照：Object::_construct_object / ObjectDB::add_instance
func _allocate(slots, slot, class_label, ref_counted, validator):
	slots[slot] = {"validator": validator, "class": class_label, "ref_counted": ref_counted, "refs": 1 if ref_counted else 0}
	return {"slot": slot, "validator": validator}

# C++ 对照：ObjectDB::get_instance with ObjectID validator
func _resolve(slots, object_id):
	var slot = object_id["slot"]
	if not slots.has(slot) or slots[slot]["validator"] != object_id["validator"]:
		return null
	return slots[slot]

# C++ 对照：Object::_predelete / ObjectDB::remove_instance
func _free_object(slots, object_id):
	var slot = object_id["slot"]
	if _resolve(slots, object_id) != null:
		slots.erase(slot)

# C++ 对照：RefCounted::reference
func _ref(slots, object_id):
	slots[object_id["slot"]]["refs"] += 1

# C++ 对照：RefCounted::unreference
func _unref(slots, object_id):
	var slot = object_id["slot"]
	slots[slot]["refs"] -= 1
	if slots[slot]["refs"] == 0:
		slots.erase(slot)
