# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends Reference

# MethodBind-like dispatch model separates name lookup from Variant argument passing.
func run():
	var object = {"position": Vector2(0, 0)}
	var call_result = _call_method(object, "set_pos", [Vector2(12, 24)])
	print("[replay S09] MethodBind call result: ", call_result)
	print("[replay S09] dynamic property read: ", _get_property(object, "position"))
	_set_property(object, "position", Vector2(30, 40))
	print("[replay S09] property write then getter: ", _call_method(object, "get_pos", []))

func _call_method(object, method, args):
	if method == "set_pos":
		_set_property(object, "position", args[0])
		return null
	if method == "get_pos":
		return _get_property(object, "position")
	return null

func _set_property(object, name, value):
	object[name] = value

func _get_property(object, name):
	return object[name]
