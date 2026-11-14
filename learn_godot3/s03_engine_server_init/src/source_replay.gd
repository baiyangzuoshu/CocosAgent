# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends Reference

# Mini registry model: type metadata/factory registration precedes instance creation.
func run():
	var types = {}
	_register_type(types, "Object", "", false)
	_register_type(types, "Node", "Object", true)
	_register_type(types, "RenderingServer", "Object", true)
	_register_singleton("RenderingServer")
	_register_singleton("Input")
	print("[replay S03] registered: ", types.keys())
	print("[replay S03] singleton order: RenderingServer → Input")
	print("[replay S03] startup registration creates factories; it does not create every instance")

func _register_type(types, type_name, base_name, can_create):
	types[type_name] = {"base": base_name, "factory": can_create}
	print("[replay S03] type ", type_name, " extends ", base_name, " factory=", can_create)

func _register_singleton(name):
	print("[replay S03] expose singleton: ", name)
