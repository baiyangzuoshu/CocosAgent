# S08 Godot 2.1: ObjectTypeDB::register_type stores a base link and factory.
extends Reference

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

func _register_type(db, name, base, factory):
	db[name] = {"base": base, "factory": factory}

func _can_instance(db, name):
	return db.has(name) and db[name]["factory"]

func _instance(db, name, new_id):
	if not _can_instance(db, name):
		return null
	return {"class": name, "instance_ID": new_id}

func _parent_chain(db, name):
	var chain = []
	var current = name
	while current != "" and db.has(current):
		chain.append(current)
		current = db[current]["base"]
	return chain
