# S07 Godot 2.1: ObjectDB lifetime is explicit for Object, refcount-driven for Reference.
extends Reference

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

func _register(db, instance_id, class_label, refs):
	db[instance_id] = {"class": class_label, "refs": refs}
	return instance_id

func _lookup(db, instance_id):
	return db.get(instance_id, null)

func _remove(db, instance_id):
	db.erase(instance_id)

func _ref(db, instance_id):
	db[instance_id]["refs"] += 1

func _unref(db, instance_id):
	db[instance_id]["refs"] -= 1
	if db[instance_id]["refs"] <= 0:
		_remove(db, instance_id)
