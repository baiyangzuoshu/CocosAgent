# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends Reference

# C++ focus: ObjectTypeDB / Globals register_type metadata and class instance factories.
func run():
	var registry = {}
	_register_class(registry, "Object", "", false, false)
	_register_class(registry, "Node", "Object", true, false)
	_register_class(registry, "CanvasItem", "Node", false, true)
	_register_class(registry, "Node2D", "CanvasItem", true, false)
	print("[replay S08] Node2D registered=", registry.has("Node2D"))
	print("[replay S08] abstract CanvasItem instantiable=", _can_instantiate(registry, "CanvasItem"))
	print("[replay S08] factory result=", _instantiate(registry, "Node2D"))
	print("[replay S08] base chain=", _base_chain(registry, "Node2D"))

func _register_class(registry, name, base, has_factory, abstract):
	if base != "" and not registry.has(base):
		return false
	registry[name] = {"base": base, "has_factory": has_factory, "abstract": abstract}
	return true

func _can_instantiate(registry, name):
	return registry.has(name) and registry[name]["has_factory"] and not registry[name]["abstract"]

func _instantiate(registry, name):
	if not _can_instantiate(registry, name):
		return null
	return {"class": name, "instance_id": 2001, "base": registry[name]["base"]}

func _base_chain(registry, name):
	var result = []
	var current = name
	while current != "" and registry.has(current):
		result.append(current)
		current = registry[current]["base"]
	return result
