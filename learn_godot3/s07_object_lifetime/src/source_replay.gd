# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends Reference

# C++ focus: ObjectDB ID registration/free and Reference/RefCounted reference count.
func run():
	var db = {}
	var manual_id = _objectdb_insert(db, 1001, "Object", 0)
	var ref_id = _objectdb_insert(db, 1002, "Reference", 1)
	print("[replay S07] registered id=", manual_id, " class=", _objectdb_get(db, manual_id)["class"])
	_objectdb_erase(db, manual_id)
	print("[replay S07] explicit Object.free; lookup=", _objectdb_get(db, manual_id))
	_reference(db, ref_id)
	print("[replay S07] copied Ref handle count=", db[ref_id]["refcount"])
	_unreference(db, ref_id)
	print("[replay S07] one owner released; alive=", _objectdb_get(db, ref_id) != null)
	_unreference(db, ref_id)
	print("[replay S07] last owner released; lookup=", _objectdb_get(db, ref_id))

func _objectdb_insert(db, object_id, class_type, refcount):
	db[object_id] = {"class": class_type, "refcount": refcount}
	return object_id

func _objectdb_get(db, object_id):
	if db.has(object_id):
		return db[object_id]
	return null

func _objectdb_erase(db, object_id):
	if db.has(object_id):
		db.erase(object_id)

func _reference(db, object_id):
	if db.has(object_id):
		db[object_id]["refcount"] += 1

func _unreference(db, object_id):
	if not db.has(object_id):
		return
	db[object_id]["refcount"] -= 1
	if db[object_id]["refcount"] <= 0:
		_objectdb_erase(db, object_id)
