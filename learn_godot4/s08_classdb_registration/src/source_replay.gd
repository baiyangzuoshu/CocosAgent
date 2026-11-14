# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends RefCounted

# Mini %s model: register inheritance/factory metadata, then instantiate by name.
func run():
	var registry = {}
	_register(registry, "Object", "", false)
	_register(registry, "Node", "Object", true)
	_register(registry, "CanvasItem", "Node", false)
	_register(registry, "Node2D", "CanvasItem", true)
	print("[replay S08] Node2D can instantiate: ", _can_instantiate(registry, "Node2D"))
	var object = _create(registry, "Node2D")
	print("[replay S08] factory result: ", object)
	print("[replay S08] registered base chain: ", _base_chain(registry, "Node2D"))

func _register(registry, name, base, factory):
	registry[name] = {"base": base, "factory": factory}
	print("[replay S08] register type: ", name, " extends ", base, " factory=", factory)

func _can_instantiate(registry, name):
	return registry.has(name) and registry[name]["factory"]

func _create(registry, name):
	if not _can_instantiate(registry, name):
		return null
	return {"class": name, "base": registry[name]["base"]}

func _base_chain(registry, name):
	var chain = []
	var current = name
	while current != "":
		chain.append(current)
		current = registry[current]["base"]
	return chain
