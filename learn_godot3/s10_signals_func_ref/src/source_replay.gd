# S10 Godot 3.6: legacy object/method connection and FuncRef(ObjectID, function).
extends Reference

func run():
	var objects = {41: {"score": 0}}
	var connections = []
	var status = _connect(connections, "score_changed", 41, "on_score", [])
	var duplicate = _connect(connections, "score_changed", 41, "on_score", [])
	_emit(objects, connections, "score_changed", [7])
	var func_ref = {"object_id": 41, "function": "double_score"}
	var call_result = _call_func(objects, func_ref, [7])
	print("[replay S10] connect error=", status, " duplicate result=", duplicate)
	print("[replay S10] emit_signal updated score=", objects[41]["score"])
	print("[replay S10] FuncRef.call_func=", call_result)

func _connect(connections, signal_name, target_id, method, binds):
	for connection in connections:
		if connection["signal"] == signal_name and connection["target"] == target_id and connection["method"] == method:
			return "duplicate connection rejected"
	connections.append({"signal": signal_name, "target": target_id, "method": method, "binds": binds})
	return "OK"

func _emit(objects, connections, signal_name, emitted_args):
	for connection in connections.duplicate():
		if connection["signal"] == signal_name:
			_call_object(objects, connection["target"], connection["method"], emitted_args + connection["binds"])

func _call_func(objects, func_ref, args):
	return _call_object(objects, func_ref["object_id"], func_ref["function"], args)

func _call_object(objects, object_id, method, args):
	if not objects.has(object_id):
		return null
	if method == "on_score":
		objects[object_id]["score"] = args[0]
		return null
	if method == "double_score":
		return args[0] * 2
	return null
