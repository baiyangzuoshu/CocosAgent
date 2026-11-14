# S10 Godot 3.6: legacy object/method connection and FuncRef(ObjectID, function).
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
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

# C++ 对照：Object::connect / connection table duplicate checks
func _connect(connections, signal_name, target_id, method, binds):
	for connection in connections:
		if connection["signal"] == signal_name and connection["target"] == target_id and connection["method"] == method:
			return "duplicate connection rejected"
	connections.append({"signal": signal_name, "target": target_id, "method": method, "binds": binds})
	return "OK"

# C++ 对照：Object::emit_signal → target Object::call
func _emit(objects, connections, signal_name, emitted_args):
	for connection in connections.duplicate():
		if connection["signal"] == signal_name:
			_call_object(objects, connection["target"], connection["method"], emitted_args + connection["binds"])

# C++ 对照：FuncRef::call_func / call_funcv
func _call_func(objects, func_ref, args):
	return _call_object(objects, func_ref["object_id"], func_ref["function"], args)

# C++ 对照：ObjectDB::get_instance → Object::call
func _call_object(objects, object_id, method, args):
	if not objects.has(object_id):
		return null
	if method == "on_score":
		objects[object_id]["score"] = args[0]
		return null
	if method == "double_score":
		return args[0] * 2
	return null
