# S08 Godot 1.1: ObjectTypeDB keeps parent metadata and optional creator function.
extends Reference

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

func _register_type(types, name, base, has_creator):
	types[name] = {"base": base, "creator": has_creator}

func _can_create(types, name):
	return types.has(name) and types[name]["creator"]

func _instance(types, name, instance_id):
	if not _can_create(types, name):
		return null
	return {"class": name, "id": instance_id}

func _inherits(types, name, base):
	var current = name
	while current != "":
		if current == base:
			return true
		if not types.has(current):
			return false
		current = types[current]["base"]
	return false
