# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends Reference

# Signal map → Object::call; FuncRef retains ObjectID + method name.
func run():
	var objects = {41: {"name": "Receiver", "score": 0}}
	var connections = []
	var connected = _connect_signal(connections, "score_changed", 41, "on_score", [])
	var duplicate = _connect_signal(connections, "score_changed", 41, "on_score", [])
	_emit_signal(objects, connections, "score_changed", [7])
	var function_ref = {"object_id": 41, "function": "double_score"}
	var result = _call_func(objects, function_ref, [7])
	print("[replay S10] connected=", connected, " duplicate rejected=", not duplicate)
	print("[replay S10] receiver score=", objects[41]["score"], " FuncRef result=", result)

func _connect_signal(connections, signal_name, object_id, method, binds):
	for item in connections:
		if item["signal"] == signal_name and item["object_id"] == object_id and item["method"] == method:
			return false
	connections.append({"signal": signal_name, "object_id": object_id, "method": method, "binds": binds})
	return true

func _emit_signal(objects, connections, signal_name, args):
	for item in connections.duplicate():
		if item["signal"] == signal_name:
			_call_object(objects, item["object_id"], item["method"], args + item["binds"])

func _call_func(objects, function_ref, args):
	return _call_object(objects, function_ref["object_id"], function_ref["function"], args)

func _call_object(objects, object_id, method, args):
	if not objects.has(object_id):
		return null
	if method == "on_score":
		objects[object_id]["score"] = args[0]
		return null
	if method == "double_score":
		return args[0] * 2
	return null
