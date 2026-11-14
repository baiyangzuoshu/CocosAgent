# S08 Godot 4.7: ClassDB::instantiate uses registered creation info and abstract flags.
extends RefCounted

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

func _register_class(db, name, base, has_creation_info, abstract):
	db[name] = {"base": base, "creation_info": has_creation_info, "abstract": abstract}

func _can_instantiate(db, name):
	return db.has(name) and db[name]["creation_info"] and not db[name]["abstract"]

func _instantiate(db, name, instance_id):
	if not _can_instantiate(db, name):
		return null
	return {"class": name, "id": instance_id, "factory": "ClassDB::instantiate"}

func _is_class(db, name, base):
	var current = name
	while current != "" and db.has(current):
		if current == base:
			return true
		current = db[current]["base"]
	return false
