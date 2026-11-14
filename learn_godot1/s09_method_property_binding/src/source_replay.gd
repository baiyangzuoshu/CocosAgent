# S09 Godot 1.1: registered MethodBind routes set_pos/get_pos and transform/pos.
extends Reference

func run():
	var registry = {"set_pos": {"argc": 1, "body": "set_pos"}, "get_pos": {"argc": 0, "body": "get_pos"}}
	var properties = {"transform/pos": {"setter": "set_pos", "getter": "get_pos"}}
	var node = {"pos": Vector2(0, 0)}
	_bind_property(properties, "transform/pos", "set_pos", "get_pos")
	var write = _callv(node, registry, "set_pos", [Vector2(12, 24)])
	var through_property = _get(node, properties, registry, "transform/pos")
	_set(node, properties, registry, "transform/pos", Vector2(30, 40))
	var final_pos = _callv(node, registry, "get_pos", [])
	print("[replay S09] callv result=", write, " first property read=", through_property["value"])
	print("[replay S09] property setter then MethodBind getter=", final_pos["value"])
	print("[replay S09] missing argument=", _callv(node, registry, "set_pos", []))

func _bind_property(properties, path, setter, getter):
	properties[path] = {"setter": setter, "getter": getter}

func _callv(node, registry, method, args):
	if not registry.has(method):
		return {"error": "invalid method", "value": null}
	var bind = registry[method]
	if args.size() != bind["argc"]:
		return {"error": "too few/many arguments", "value": null}
	if bind["body"] == "set_pos":
		node["pos"] = args[0]
		return {"error": "OK", "value": null}
	if bind["body"] == "get_pos":
		return {"error": "OK", "value": node["pos"]}
	return {"error": "unimplemented", "value": null}

func _get(node, properties, registry, path):
	if not properties.has(path):
		return {"error": "property not found", "value": null}
	return _callv(node, registry, properties[path]["getter"], [])

func _set(node, properties, registry, path, value):
	if not properties.has(path):
		return false
	return _callv(node, registry, properties[path]["setter"], [value])["error"] == "OK"
