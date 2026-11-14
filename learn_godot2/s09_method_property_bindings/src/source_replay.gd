# S09 Godot 2.1: ObjectTypeDB property metadata delegates to MethodBind callv.
extends Reference

func run():
	var method_binds = {}
	var properties = {}
	var node2d = {"pos": Vector2(0, 0)}
	_register_method(method_binds, "set_pos", 1, "set_pos")
	_register_method(method_binds, "get_pos", 0, "get_pos")
	_register_property(properties, "transform/pos", "set_pos", "get_pos")
	var call_result = _callv(node2d, method_binds, "set_pos", [Vector2(12, 24)])
	var read_result = _get_property(node2d, properties, method_binds, "transform/pos")
	_set_property(node2d, properties, method_binds, "transform/pos", Vector2(30, 40))
	print("[replay S09] MethodBind callv=", call_result)
	print("[replay S09] Object::get transform/pos=", read_result)
	print("[replay S09] setter/getter final pos=", _callv(node2d, method_binds, "get_pos", [])["value"])
	print("[replay S09] bad argument count=", _callv(node2d, method_binds, "set_pos", [])["error"])

func _register_method(method_binds, name, argument_count, native_action):
	method_binds[name] = {"argument_count": argument_count, "action": native_action}

func _register_property(properties, name, setter, getter):
	properties[name] = {"setter": setter, "getter": getter}

func _callv(node2d, method_binds, method, arguments):
	if not method_binds.has(method):
		return {"error": "method not found", "value": null}
	var bind = method_binds[method]
	if arguments.size() != bind["argument_count"]:
		return {"error": "invalid argument count", "value": null}
	if bind["action"] == "set_pos":
		node2d["pos"] = arguments[0]
		return {"error": "OK", "value": null}
	if bind["action"] == "get_pos":
		return {"error": "OK", "value": node2d["pos"]}
	return {"error": "unimplemented bind", "value": null}

func _get_property(node2d, properties, method_binds, name):
	if not properties.has(name):
		return {"error": "property not found", "value": null}
	return _callv(node2d, method_binds, properties[name]["getter"], [])

func _set_property(node2d, properties, method_binds, name, value):
	if not properties.has(name):
		return false
	return _callv(node2d, method_binds, properties[name]["setter"], [value])["error"] == "OK"
