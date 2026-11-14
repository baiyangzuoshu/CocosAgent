# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends RefCounted

# Callable object/method/bound args → Object::connect → emit_signalp → Callable::callp.
func run():
	var objects = {41: {"name": "Receiver", "score": 0}}
	var connections = []
	var callback = _callable(41, "on_score", [])
	var connected = _connect_signal(connections, "score_changed", callback)
	var duplicate = _connect_signal(connections, "score_changed", callback)
	_emit_signal(objects, connections, "score_changed", [7])
	var direct = _callp(objects, _callable(41, "double_score", []), [7])
	var bound = _callp(objects, _callable(41, "add", [5]), [2])
	print("[replay S10] connected=", connected, " duplicate rejected=", not duplicate)
	print("[replay S10] emitted score=", objects[41]["score"])
	print("[replay S10] Callable.call=", direct, " bind result=", bound)

func _callable(object_id, method, bound_args):
	return {"object_id": object_id, "method": method, "bound_args": bound_args}

func _callable_key(callable):
	return str(callable["object_id"]) + ":" + callable["method"] + ":" + str(callable["bound_args"])

func _connect_signal(connections, signal_name, callable):
	var key = _callable_key(callable)
	for item in connections:
		if item["signal"] == signal_name and _callable_key(item["callable"]) == key:
			return false
	connections.append({"signal": signal_name, "callable": callable})
	return true

func _emit_signal(objects, connections, signal_name, args):
	for item in connections.duplicate():
		if item["signal"] == signal_name:
			_callp(objects, item["callable"], args)

func _callp(objects, callable, args):
	if not objects.has(callable["object_id"]):
		return null
	var call_args = args + callable["bound_args"]
	if callable["method"] == "on_score":
		objects[callable["object_id"]]["score"] = call_args[0]
		return null
	if callable["method"] == "double_score":
		return call_args[0] * 2
	if callable["method"] == "add":
		return call_args[0] + call_args[1]
	return null
