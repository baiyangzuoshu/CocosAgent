# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends Reference

# MethodBind table → Object::set/get/callv → Node2D set_pos/get_pos.
func run():
	var binds = {}
	var properties = {"pos": {"getter": "get_pos", "setter": "set_pos"}}
	var object = {"pos": Vector2(0, 0)}
	_bind_method(binds, "set_pos", 1, "set_pos")
	_bind_method(binds, "get_pos", 0, "get_pos")
	var write_result = _callv(object, binds, "set_pos", [Vector2(12, 24)])
	var read_result = _get_property(object, properties, binds, "pos")
	_set_property(object, properties, binds, "pos", Vector2(30, 40))
	var final_result = _callv(object, binds, "get_pos", [])
	print("[replay S09] callv setter=", write_result, " property read=", read_result)
	print("[replay S09] set(pos) then get_pos=", final_result)
	print("[replay S09] bad arg count=", _callv(object, binds, "set_pos", []))

func _bind_method(binds, name, argument_count, implementation):
	binds[name] = {"argument_count": argument_count, "implementation": implementation}

func _callv(object, binds, name, args):
	if not binds.has(name):
		return {"error": "invalid method", "value": null}
	var bind = binds[name]
	if args.size() != bind["argument_count"]:
		return {"error": "argument count", "value": null}
	if bind["implementation"] == "set_pos":
		object["pos"] = args[0]
		return {"error": "", "value": null}
	if bind["implementation"] == "get_pos":
		return {"error": "", "value": object["pos"]}
	return {"error": "unimplemented", "value": null}

func _get_property(object, properties, binds, name):
	if not properties.has(name):
		return null
	return _callv(object, binds, properties[name]["getter"], [])["value"]

func _set_property(object, properties, binds, name, value):
	if not properties.has(name):
		return false
	return _callv(object, binds, properties[name]["setter"], [value])["error"] == ""
