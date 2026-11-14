# S07 Godot 3.6: ObjectDB/ObjectID registration and Reference::unreference deletion.
extends Reference

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

func _register(db, instance_id, class_label, refs):
	db[instance_id] = {"class": class_label, "refs": refs, "predelete": false}
	return instance_id

func _lookup(db, instance_id):
	return db.get(instance_id, null)

func _predelete(db, instance_id):
	db[instance_id]["predelete"] = true

func _remove(db, instance_id):
	db.erase(instance_id)

func _ref(db, instance_id):
	db[instance_id]["refs"] += 1

func _unref(db, instance_id):
	db[instance_id]["refs"] -= 1
	if db[instance_id]["refs"] <= 0:
		_remove(db, instance_id)
